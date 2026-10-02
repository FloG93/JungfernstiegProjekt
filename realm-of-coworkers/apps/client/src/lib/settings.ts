// Lokale Einstellungen (14.6, 14.9): Ton, Barrierefreiheit, Steuerung. Liegen im Browser, nicht auf dem Server.
import { Store } from './store';

export type TelegraphStyle = 'standard' | 'outline' | 'blue';
export type ColorBlind = 'off' | 'protan' | 'tritan';

export interface Settings {
  music: number;
  sfx: number;
  ui: number;
  mute: boolean;
  telegraph: TelegraphStyle;
  colorBlind: ColorBlind;
  /** Schriftgröße in Prozent (100, 125, 150). */
  fontScale: number;
  /** HUD-Größe in Prozent (80 bis 130). */
  hudScale: number;
  reduceMotion: boolean;
  /** Linkshänder: Stick rechts, Fähigkeiten links. */
  leftHanded: boolean;
  /** Bildschirmrand-Warnung bei großen Telegraphen (14.6). */
  edgeWarning: boolean;
  /** Zahlen über den Köpfen anzeigen. */
  damageNumbers: boolean;
  keys: Record<string, string>;
}

export const DEFAULT_KEYS: Record<string, string> = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', roll: 'Space', s1: 'Digit1', s2: 'Digit2', s3: 'Digit3',
  ult: 'KeyR', potion: 'KeyF', swap: 'KeyQ', target: 'Tab', autowalk: 'KeyT', pause: 'KeyP', chat: 'Enter',
};

const DEFAULTS: Settings = {
  music: 40, sfx: 70, ui: 60, mute: false, telegraph: 'standard', colorBlind: 'off', fontScale: 100, hudScale: 100,
  reduceMotion: false, leftHanded: false, edgeWarning: false, damageNumbers: true, keys: DEFAULT_KEYS,
};

const KEY = 'aethra.settings.v1';

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const s = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...s, keys: { ...DEFAULT_KEYS, ...(s.keys ?? {}) } };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = new Store<Settings>(load());

settings.subscribe(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings.get()));
  } catch {
    // privates Fenster: Einstellungen gelten nur für diese Sitzung
  }
  applyDocumentSettings();
});

/** Schriftgröße, HUD-Größe und Paletten als CSS-Variablen bzw. Klassen. */
export function applyDocumentSettings(): void {
  const s = settings.get();
  const root = document.documentElement;
  root.style.setProperty('--font-scale', String(s.fontScale / 100));
  root.style.setProperty('--hud-scale', String(s.hudScale / 100));
  root.dataset['cb'] = s.colorBlind;
  root.dataset['motion'] = s.reduceMotion ? 'reduce' : 'full';
  root.dataset['hand'] = s.leftHanded ? 'left' : 'right';
}
