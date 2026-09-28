# PyInstaller-Spec für PianoScribe (onedir: ein Ordner, zwei Programme).
#
# Aufruf (aus pianoscribe/backend, normalerweise über packaging/build.ps1):
#   uv run pyinstaller ../packaging/pianoscribe.spec --noconfirm --clean
#       --distpath ../packaging/dist --workpath ../packaging/build
#
# Ergebnis in packaging/dist/PianoScribe/:
#   PianoScribe.exe       Desktop-App (ohne Konsolenfenster)
#   pianoscribe-cli.exe   dieselbe Installation als Kommandozeile (selftest, run, info …)
#   _internal/            Python, PyTorch mit CUDA-DLLs, Oberfläche, Samples, ffmpeg
#
# Die Modellgewichte werden nicht gebündelt; die App lädt sie beim ersten Start nach
# %LOCALAPPDATA%\PianoScribe\models. Pfade im Bundle löst pianoscribe/paths.py auf
# (sys._MEIPASS = _internal).

import sys
from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

HERE = Path(SPECPATH)  # noqa: F821 - von PyInstaller gesetzt
ROOT = HERE.parent
BACKEND = ROOT / "backend"
WINDOWS = sys.platform == "win32"

sys.path.insert(0, str(BACKEND))
from pianoscribe import __version__  # noqa: E402


def need(path, hint):
    if not path.exists():
        raise SystemExit(f"\nFehlt: {path}\n-> {hint}\n")
    return path


# --- Mitgelieferte Dateien -----------------------------------------------------------------

frontend = need(ROOT / "frontend" / "dist" / "index.html",
                "Frontend bauen: cd frontend && npm ci && npm run build").parent
samples = need(ROOT / "assets" / "samples" / "salamander" / "C4.mp3",
               "Samples laden: uv run python ../scripts/fetch_assets.py").parent

datas = [
    (str(frontend), "frontend/dist"),
    (str(BACKEND / "pianoscribe" / "transcription" / "bytedance_vendor" / "LICENSE"),
     "pianoscribe/transcription/bytedance_vendor"),
]
datas += [(str(f), "assets/samples/salamander") for f in sorted(samples.iterdir())
          if f.suffix in (".mp3", ".txt")]
if WINDOWS:
    ffmpeg = need(ROOT / "assets" / "ffmpeg" / "ffmpeg.exe",
                  "ffmpeg laden: uv run python ../scripts/fetch_assets.py --ffmpeg")
    datas.append((str(ffmpeg), "assets/ffmpeg"))
    if (ffmpeg.parent / "LICENSE").exists():
        datas.append((str(ffmpeg.parent / "LICENSE"), "assets/ffmpeg"))
# Unter Linux/macOS wird das System-ffmpeg aus dem PATH benutzt (siehe paths.ffmpeg_exe).

datas += collect_data_files("demucs")  # remote/*.yaml – Modellbeschreibungen

# --- Module --------------------------------------------------------------------------------

hiddenimports = collect_submodules("pianoscribe") + [
    # uvicorn wählt Event-Loop und Protokolle über Import-Strings
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.lifespan.on",
    # Modellklassen, die demucs beim Laden der Checkpoints per pickle importiert
    "demucs.htdemucs",
    "demucs.hdemucs",
    "demucs.demucs",
    "demucs.transformer",
    "demucs.spec",
    "demucs.states",
]

excludes = [
    # Entwicklungs- und Testwerkzeuge
    "pytest", "_pytest", "mypy", "ruff", "IPython", "notebook", "verovio", "mir_eval",
    # andere GUI-Toolkits (pywebview nutzt unter Windows WinForms + Edge WebView2)
    "tkinter", "_tkinter", "PyQt5", "PyQt6", "PySide2", "PySide6", "qtpy", "gi",
    # nur für Training bzw. für den (nicht benutzten) HuggingFace-Download von demucs
    "pytorch_lightning", "lightning", "tensorboard", "torch.utils.tensorboard",
    "huggingface_hub",
]

a = Analysis(
    [str(HERE / "launcher.py")],
    pathex=[str(BACKEND)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,  # torch braucht Docstrings
)
pyz = PYZ(a.pure)


# --- Programme -----------------------------------------------------------------------------

def version_info(filename, description):
    """Windows-Dateieigenschaften (Version, Beschreibung)."""
    if not WINDOWS:
        return None
    from PyInstaller.utils.win32.versioninfo import (
        FixedFileInfo,
        StringFileInfo,
        StringStruct,
        StringTable,
        VarFileInfo,
        VarStruct,
        VSVersionInfo,
    )

    numbers = tuple(int(part) for part in __version__.split(".")[:3])
    numbers = numbers + (0,) * (4 - len(numbers))
    strings = {
        "CompanyName": "PianoScribe",
        "FileDescription": description,
        "FileVersion": __version__,
        "InternalName": Path(filename).stem,
        "LegalCopyright": "MIT-Lizenz",
        "OriginalFilename": filename,
        "ProductName": "PianoScribe",
        "ProductVersion": __version__,
    }
    return VSVersionInfo(
        ffi=FixedFileInfo(filevers=numbers, prodvers=numbers),
        kids=[
            StringFileInfo([StringTable("040704B0",
                                        [StringStruct(k, v) for k, v in strings.items()])]),
            VarFileInfo([VarStruct("Translation", [0x0407, 1200])]),
        ],
    )


common = dict(
    exclude_binaries=True,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # UPX beschädigt CUDA-DLLs und bremst den Start
    icon=str(HERE / "pianoscribe.ico"),
)
app_exe = EXE(pyz, a.scripts, [], name="PianoScribe", console=False,
              version=version_info("PianoScribe.exe", "PianoScribe"), **common)
cli_exe = EXE(pyz, a.scripts, [], name="pianoscribe-cli", console=True,
              version=version_info("pianoscribe-cli.exe", "PianoScribe (Kommandozeile)"),
              **common)

coll = COLLECT(
    app_exe,
    cli_exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="PianoScribe",
)
