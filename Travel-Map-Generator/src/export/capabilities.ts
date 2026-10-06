/**
 * Was der Browser für den Video-Export wirklich kann.
 *
 * Hintergrund: GitHub Pages kann die Header `Cross-Origin-Opener-Policy` und
 * `Cross-Origin-Embedder-Policy` nicht setzen. Ohne sie gibt es keinen
 * `SharedArrayBuffer`, und ohne den läuft `ffmpeg.wasm` nur einkernig – also
 * deutlich langsamer. Darum ist WebCodecs der Hauptpfad und wir sagen dem
 * Nutzer von Anfang an, was gerade möglich ist, statt ihn in einen Export
 * laufen zu lassen, der nach zehn Minuten abbricht.
 */

/** Rohe Messwerte aus der Umgebung – bewusst getrennt von der Bewertung. */
export interface CapabilityProbe {
  /** `window.VideoEncoder` vorhanden (WebCodecs). */
  hasVideoEncoder: boolean
  /** `window.crossOriginIsolated` – Voraussetzung für `SharedArrayBuffer`. */
  isCrossOriginIsolated: boolean
  /** `OffscreenCanvas` vorhanden – erlaubt Rendern ohne sichtbares Canvas. */
  hasOffscreenCanvas: boolean
  /** `showSaveFilePicker` vorhanden – erlaubt Streaming direkt in eine Datei. */
  hasFileSystemAccess: boolean
}

/** Welcher Encoder-Pfad benutzt wird. */
export type EncoderPath = 'webcodecs' | 'ffmpeg-wasm-mt' | 'ffmpeg-wasm-st'

/** Wege, eine Spur mit Transparenz auszugeben (Meilenstein M7). */
export type AlphaPath = 'png-sequence' | 'webm-alpha' | 'prores'

export interface CapabilityReport {
  path: EncoderPath
  /** Kurzer Text für die Fußzeile. */
  label: string
  /** Was das für den Nutzer bedeutet – eine Zeile, ohne Fachjargon. */
  note: string
  /** Immer mindestens `png-sequence`; der funktioniert überall. */
  alphaPaths: AlphaPath[]
  /** Große Exporte können ohne Datei-Streaming am Speicher scheitern. */
  canStreamToDisk: boolean
}

const LABELS: Record<EncoderPath, string> = {
  webcodecs: 'WebCodecs (schnell)',
  'ffmpeg-wasm-mt': 'ffmpeg.wasm, mehrkernig',
  'ffmpeg-wasm-st': 'ffmpeg.wasm, einkernig (langsam)',
}

const NOTES: Record<EncoderPath, string> = {
  webcodecs:
    'Video-Export läuft hardwarebeschleunigt über den Browser – der schnelle Weg.',
  'ffmpeg-wasm-mt':
    'Kein WebCodecs in diesem Browser; Export läuft über ffmpeg.wasm mit mehreren Kernen.',
  'ffmpeg-wasm-st':
    'Kein WebCodecs und keine Cross-Origin-Isolation: Export ist möglich, dauert aber ein Vielfaches. Die PNG-Sequenz ist hier oft der bessere Weg.',
}

/** Bewertet die Messwerte. Reine Funktion – deshalb testbar. */
export function evaluateCapabilities(probe: CapabilityProbe): CapabilityReport {
  const path: EncoderPath = probe.hasVideoEncoder
    ? 'webcodecs'
    : probe.isCrossOriginIsolated
      ? 'ffmpeg-wasm-mt'
      : 'ffmpeg-wasm-st'

  // Die PNG-Sequenz braucht nur ein Canvas und ein ZIP – sie geht immer.
  const alphaPaths: AlphaPath[] = ['png-sequence']
  if (probe.hasVideoEncoder) alphaPaths.push('webm-alpha')
  // ProRes entsteht ausschließlich in ffmpeg, und dort nur mehrkernig
  // in vertretbarer Zeit.
  if (probe.isCrossOriginIsolated) alphaPaths.push('prores')

  return {
    path,
    label: LABELS[path],
    note: NOTES[path],
    alphaPaths,
    canStreamToDisk: probe.hasFileSystemAccess,
  }
}

/** Liest die echten Werte aus dem Browser. Absichtlich dünn gehalten. */
export function probeBrowser(): CapabilityProbe {
  const scope = globalThis as typeof globalThis & {
    VideoEncoder?: unknown
    OffscreenCanvas?: unknown
    showSaveFilePicker?: unknown
  }
  return {
    hasVideoEncoder: typeof scope.VideoEncoder === 'function',
    isCrossOriginIsolated: globalThis.crossOriginIsolated === true,
    hasOffscreenCanvas: typeof scope.OffscreenCanvas === 'function',
    hasFileSystemAccess: typeof scope.showSaveFilePicker === 'function',
  }
}
