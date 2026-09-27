// Native Funktionen über die pywebview-Bridge (js_api) mit Browser-Fallback.

interface PyWebviewApi {
  open_audio_dialog(): Promise<string | null>;
  save_file_dialog(defaultName: string, filetypes: string[]): Promise<string | null>;
  write_file(path: string, base64: string): Promise<boolean>;
}

declare global {
  interface Window {
    pywebview?: { api: PyWebviewApi };
  }
}

let ready: Promise<PyWebviewApi | null> | null = null;

/** Wartet kurz auf die Bridge (pywebview injiziert sie nach dem Laden). */
export function bridge(): Promise<PyWebviewApi | null> {
  if (!ready) {
    ready = new Promise((resolve) => {
      if (window.pywebview?.api) {
        resolve(window.pywebview.api);
        return;
      }
      const timer = window.setTimeout(() => resolve(null), 1500);
      window.addEventListener("pywebviewready", () => {
        window.clearTimeout(timer);
        resolve(window.pywebview?.api ?? null);
      });
    });
  }
  return ready;
}

export type PickedAudio = { kind: "path"; path: string } | { kind: "file"; file: File };

const AUDIO_ACCEPT = ".mp3,.m4a,.aac,.flac,.wav,.ogg,.oga,.opus,.wma";

export async function pickAudioFile(): Promise<PickedAudio | null> {
  const api = await bridge();
  if (api) {
    const path = await api.open_audio_dialog();
    return path ? { kind: "path", path } : null;
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = AUDIO_ACCEPT;
    input.onchange = () => {
      const file = input.files?.[0];
      resolve(file ? { kind: "file", file } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

async function toBase64(data: Blob): Promise<string> {
  const buffer = new Uint8Array(await data.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Speichert eine Datei: nativer Dialog in der App, Download-Link im Browser. */
export async function saveFile(defaultName: string, filetype: string, data: Blob): Promise<boolean> {
  const api = await bridge();
  if (api) {
    const path = await api.save_file_dialog(defaultName, [filetype]);
    if (!path) return false;
    return api.write_file(path, await toBase64(data));
  }
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = defaultName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}
