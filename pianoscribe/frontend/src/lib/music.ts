// Musikalische Hilfen für die Oberfläche: Tonartenliste, Notennamen, Taktarten.

export interface KeyOption {
  value: string; // music21-Format, z. B. "E- major"
  label: string; // deutsch, z. B. "Es-Dur"
}

const MAJOR: [string, string][] = [
  ["C", "C"], ["G", "G"], ["D", "D"], ["A", "A"], ["E", "E"], ["B", "H"], ["F#", "Fis"],
  ["C#", "Cis"], ["F", "F"], ["B-", "B"], ["E-", "Es"], ["A-", "As"], ["D-", "Des"],
  ["G-", "Ges"], ["C-", "Ces"],
];
const MINOR: [string, string][] = [
  ["a", "a"], ["e", "e"], ["b", "h"], ["f#", "fis"], ["c#", "cis"], ["g#", "gis"], ["d#", "dis"],
  ["a#", "ais"], ["d", "d"], ["g", "g"], ["c", "c"], ["f", "f"], ["b-", "b"], ["e-", "es"],
  ["a-", "as"],
];

export const KEY_OPTIONS: KeyOption[] = [
  ...MAJOR.map(([v, l]) => ({ value: `${v} major`, label: `${l}-Dur` })),
  ...MINOR.map(([v, l]) => ({ value: `${v} minor`, label: `${l}-Moll` })),
];

export const TIME_SIGNATURES = ["2/4", "3/4", "4/4", "5/4", "2/2", "3/8", "6/8", "9/8", "12/8"];

const NAMES_DE = ["C", "Cis", "D", "Dis", "E", "F", "Fis", "G", "Gis", "A", "B", "H"];
const NAMES_TONE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** Deutscher Notenname mit Oktave (wissenschaftlich): 60 → C4 */
export function noteNameDe(midi: number): string {
  return `${NAMES_DE[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Notenname für Tone.js: 61 → C#4 */
export function noteNameTone(midi: number): string {
  return `${NAMES_TONE[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Auswahl für den festen Split: C3 bis C5 */
export const SPLIT_OPTIONS = Array.from({ length: 25 }, (_, i) => 48 + i).map((midi) => ({
  value: midi,
  label: noteNameDe(midi),
}));

/** Salamander-Auswahl (jede kleine Terz), Dateinamen wie in assets/samples/salamander */
export const SALAMANDER_URLS: Record<string, string> = (() => {
  const urls: Record<string, string> = {};
  const letters: [string, string][] = [["C", "C"], ["D#", "Ds"], ["F#", "Fs"], ["A", "A"]];
  for (let octave = 0; octave <= 8; octave++) {
    for (const [tone, file] of letters) {
      const name = `${tone}${octave}`;
      const midi = 12 * (octave + 1) + NAMES_TONE.indexOf(tone);
      if (midi >= 21 && midi <= 108) urls[name] = `${file}${octave}.mp3`;
    }
  }
  return urls;
})();
