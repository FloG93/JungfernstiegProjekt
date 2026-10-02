"""CRNN-Modelle der ByteDance-Klaviertranskription (Kong et al., 2020).

Angepasst aus piano_transcription_inference/models.py und torchlibrosa/stft.py (MIT, siehe
LICENSE). Die STFT-Kernel und die Mel-Matrix sind Parameter und werden aus dem Checkpoint
geladen; dadurch entfallen librosa und torchlibrosa.
"""

from __future__ import annotations

import torch
import torch.nn.functional as F
from torch import nn

SAMPLE_RATE = 16000
FRAMES_PER_SECOND = 100
CLASSES_NUM = 88
BEGIN_NOTE = 21
VELOCITY_SCALE = 128

_WINDOW_SIZE = 2048
_HOP_SIZE = SAMPLE_RATE // FRAMES_PER_SECOND
_MEL_BINS = 229
_MIDFEAT = 1792
_MOMENTUM = 0.01
# Das Original ruft nn.BatchNorm2d(n, momentum) auf und setzt damit positionsbedingt eps=0.01.
# Die Gewichte wurden so trainiert; eps muss deshalb 0.01 bleiben.
_BN2D_EPS = 0.01
_AMIN = 1e-10


class _STFT(nn.Module):
    """STFT als Conv1d (wie torchlibrosa); Gewichte stammen aus dem Checkpoint."""

    def __init__(self) -> None:
        super().__init__()
        bins = _WINDOW_SIZE // 2 + 1
        self.conv_real = nn.Conv1d(1, bins, kernel_size=_WINDOW_SIZE, stride=_HOP_SIZE, bias=False)
        self.conv_imag = nn.Conv1d(1, bins, kernel_size=_WINDOW_SIZE, stride=_HOP_SIZE, bias=False)
        for param in self.parameters():
            param.requires_grad = False

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        x = F.pad(x[:, None, :], pad=(_WINDOW_SIZE // 2, _WINDOW_SIZE // 2), mode="reflect")
        real = self.conv_real(x)[:, None, :, :].transpose(2, 3)
        imag = self.conv_imag(x)[:, None, :, :].transpose(2, 3)
        return real, imag


class _Spectrogram(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.stft = _STFT()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        real, imag = self.stft(x)
        return real**2 + imag**2  # (batch, 1, time, bins)


class _LogmelFilterBank(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.melW = nn.Parameter(torch.zeros(_WINDOW_SIZE // 2 + 1, _MEL_BINS),
                                 requires_grad=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        mel = torch.matmul(x, self.melW)
        return 10.0 * torch.log10(torch.clamp(mel, min=_AMIN))  # ref=1.0, top_db=None


class _ConvBlock(nn.Module):
    def __init__(self, in_channels: int, out_channels: int) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(in_channels, out_channels, (3, 3), (1, 1), (1, 1), bias=False)
        self.conv2 = nn.Conv2d(out_channels, out_channels, (3, 3), (1, 1), (1, 1), bias=False)
        self.bn1 = nn.BatchNorm2d(out_channels, eps=_BN2D_EPS)
        self.bn2 = nn.BatchNorm2d(out_channels, eps=_BN2D_EPS)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = F.relu_(self.bn1(self.conv1(x)))
        x = F.relu_(self.bn2(self.conv2(x)))
        return F.avg_pool2d(x, kernel_size=(1, 2))


class _AcousticModelCRnn8(nn.Module):
    def __init__(self, classes_num: int) -> None:
        super().__init__()
        self.conv_block1 = _ConvBlock(1, 48)
        self.conv_block2 = _ConvBlock(48, 64)
        self.conv_block3 = _ConvBlock(64, 96)
        self.conv_block4 = _ConvBlock(96, 128)
        self.fc5 = nn.Linear(_MIDFEAT, 768, bias=False)
        self.bn5 = nn.BatchNorm1d(768, momentum=_MOMENTUM)
        self.gru = nn.GRU(input_size=768, hidden_size=256, num_layers=2, bias=True,
                          batch_first=True, dropout=0.0, bidirectional=True)
        self.fc = nn.Linear(512, classes_num, bias=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.conv_block1(x)
        x = self.conv_block2(x)
        x = self.conv_block3(x)
        x = self.conv_block4(x)
        x = x.transpose(1, 2).flatten(2)
        x = F.relu(self.bn5(self.fc5(x).transpose(1, 2)).transpose(1, 2))
        x, _ = self.gru(x)
        return torch.sigmoid(self.fc(x))


class _Frontend(nn.Module):
    """Gemeinsamer Anfang beider Modelle: Log-Mel-Spektrogramm + BatchNorm."""

    def __init__(self) -> None:
        super().__init__()
        self.spectrogram_extractor = _Spectrogram()
        self.logmel_extractor = _LogmelFilterBank()
        self.bn0 = nn.BatchNorm2d(_MEL_BINS, eps=_BN2D_EPS)

    def features(self, audio: torch.Tensor) -> torch.Tensor:
        x = self.logmel_extractor(self.spectrogram_extractor(audio))
        return self.bn0(x.transpose(1, 3)).transpose(1, 3)


class RegressOnsetOffsetFrameVelocityCRNN(_Frontend):
    def __init__(self) -> None:
        super().__init__()
        self.frame_model = _AcousticModelCRnn8(CLASSES_NUM)
        self.reg_onset_model = _AcousticModelCRnn8(CLASSES_NUM)
        self.reg_offset_model = _AcousticModelCRnn8(CLASSES_NUM)
        self.velocity_model = _AcousticModelCRnn8(CLASSES_NUM)
        self.reg_onset_gru = nn.GRU(input_size=88 * 2, hidden_size=256, num_layers=1, bias=True,
                                    batch_first=True, dropout=0.0, bidirectional=True)
        self.reg_onset_fc = nn.Linear(512, CLASSES_NUM, bias=True)
        self.frame_gru = nn.GRU(input_size=88 * 3, hidden_size=256, num_layers=1, bias=True,
                                batch_first=True, dropout=0.0, bidirectional=True)
        self.frame_fc = nn.Linear(512, CLASSES_NUM, bias=True)

    def forward(self, audio: torch.Tensor) -> dict[str, torch.Tensor]:
        x = self.features(audio)
        frame_output = self.frame_model(x)
        reg_onset_output = self.reg_onset_model(x)
        reg_offset_output = self.reg_offset_model(x)
        velocity_output = self.velocity_model(x)

        y = torch.cat((reg_onset_output, (reg_onset_output**0.5) * velocity_output), dim=2)
        y, _ = self.reg_onset_gru(y)
        reg_onset_output = torch.sigmoid(self.reg_onset_fc(y))

        y = torch.cat((frame_output, reg_onset_output, reg_offset_output), dim=2)
        y, _ = self.frame_gru(y)
        frame_output = torch.sigmoid(self.frame_fc(y))
        return {
            "reg_onset_output": reg_onset_output,
            "reg_offset_output": reg_offset_output,
            "frame_output": frame_output,
            "velocity_output": velocity_output,
        }


class RegressPedalCRNN(_Frontend):
    def __init__(self) -> None:
        super().__init__()
        self.reg_pedal_onset_model = _AcousticModelCRnn8(1)
        self.reg_pedal_offset_model = _AcousticModelCRnn8(1)
        self.reg_pedal_frame_model = _AcousticModelCRnn8(1)

    def forward(self, audio: torch.Tensor) -> dict[str, torch.Tensor]:
        x = self.features(audio)
        return {
            "reg_pedal_onset_output": self.reg_pedal_onset_model(x),
            "reg_pedal_offset_output": self.reg_pedal_offset_model(x),
            "pedal_frame_output": self.reg_pedal_frame_model(x),
        }


class NotePedal(nn.Module):
    """Kombination aus Noten- und Pedalmodell (Struktur des Checkpoints)."""

    def __init__(self) -> None:
        super().__init__()
        self.note_model = RegressOnsetOffsetFrameVelocityCRNN()
        self.pedal_model = RegressPedalCRNN()

    def load_checkpoint(self, state: dict[str, dict[str, torch.Tensor]]) -> None:
        self.note_model.load_state_dict(state["note_model"], strict=True)
        self.pedal_model.load_state_dict(state["pedal_model"], strict=True)

    def forward(self, audio: torch.Tensor) -> dict[str, torch.Tensor]:
        out = self.note_model(audio)
        out.update(self.pedal_model(audio))
        return out
