// Farben (14.8) und Paletten für Farbsehschwäche (14.6). Elemente haben immer zusätzlich ein Symbol.
import type { ClassId, ElementId, RarityId } from '@aethra/shared';
import type { ColorBlind } from '../lib/settings';

const ELEMENT: Record<ElementId, number> = {
  physisch: 0xe8e4dc, feuer: 0xe8552b, eis: 0x6ec6f0, blitz: 0xf2d030, erde: 0x8b5e34, licht: 0xf7e39b, schatten: 0x7b4fbf,
};
/** Protanopie/Deuteranopie: Rot und Grün weichen Orange und Blau. */
const ELEMENT_PROTAN: Partial<Record<ElementId, number>> = { feuer: 0xff9f1a, eis: 0x3f8cff, erde: 0xa08060 };
/** Tritanopie: Blau und Gelb weichen Rot und Türkis. */
const ELEMENT_TRITAN: Partial<Record<ElementId, number>> = { eis: 0x40e0d0, blitz: 0xff6080, licht: 0xffd0e0 };

export const ELEMENT_SYMBOL: Record<ElementId, string> = {
  physisch: '⚔', feuer: '🔥', eis: '❄', blitz: '⚡', erde: '⛰', licht: '☀', schatten: '☾',
};

export const RARITY_COLOR: Record<RarityId, string> = {
  gewoehnlich: '#9AA0A6', ungewoehnlich: '#4CAF50', selten: '#3F8CFF', episch: '#A55CE6', legendaer: '#FF9F1A',
};

export const CLASS_COLOR: Record<ClassId, number> = {
  krieger: 0xb0413e, magier: 0x3f6fd8, waldlaeufer: 0x3f9b4f, schurke: 0x6b4fa0, kleriker: 0xd9b448, runenweber: 0x2fb3a8,
};

export const CLASS_SYMBOL: Record<ClassId, string> = {
  krieger: '🛡', magier: '✦', waldlaeufer: '➶', schurke: '🗡', kleriker: '✚', runenweber: 'ᚱ',
};

export function elementColor(el: ElementId, cb: ColorBlind): number {
  if (cb === 'protan') return ELEMENT_PROTAN[el] ?? ELEMENT[el];
  if (cb === 'tritan') return ELEMENT_TRITAN[el] ?? ELEMENT[el];
  return ELEMENT[el];
}

export function css(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** Farbe der Warnflächen nach Einstellung und Palette. */
export function dangerColor(style: 'standard' | 'outline' | 'blue', cb: ColorBlind): number {
  if (style === 'blue') return 0x3f8cff;
  if (cb === 'protan') return 0xff9f1a;
  return 0xe53935;
}

export function healColor(cb: ColorBlind): number {
  return cb === 'protan' ? 0x3fa7ff : 0x5ee07a;
}

/** Hellt eine Farbe auf (f > 0) oder dunkelt sie ab (f < 0). */
export function shade(c: number, f: number): number {
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

/** Kapitelfarben für Himmel, Hügel und Boden (Platzhalter, 14.8). */
export const CHAPTER_THEME: Record<number, { sky: number; far: number; near: number; ground: number; accent: number }> = {
  1: { sky: 0x2a1410, far: 0x4a2418, near: 0x5e2c1a, ground: 0x3b2a22, accent: 0xe8552b },
  2: { sky: 0x101c2a, far: 0x2a4258, near: 0x3a5a74, ground: 0x4a5a66, accent: 0x6ec6f0 },
  3: { sky: 0x17122a, far: 0x2c2448, near: 0x3c305e, ground: 0x34303c, accent: 0xf2d030 },
  4: { sky: 0x14180e, far: 0x2a3218, near: 0x3a4220, ground: 0x3a2e1e, accent: 0x8b5e34 },
  5: { sky: 0x2a2410, far: 0x584a24, near: 0x6e5c2c, ground: 0x5a4c34, accent: 0xf7e39b },
  6: { sky: 0x0e0a16, far: 0x221a34, near: 0x2e2244, ground: 0x221c2a, accent: 0x7b4fbf },
};
