// Schaden eines Bosses (10.4). Eigene Datei, damit die Boss-Handler sie nutzen können, ohne über
// boss.ts und die Handler-Liste im Kreis zu laufen.
import type { BossDef, Attack } from '../content/schemas';
import { refLife } from '../formulas';
import { lebende } from './typen';
import type { Figur, Kampf } from './typen';
import { unverwundbar } from './wirkung';
import { gegnerTrifft } from './wirkung';

const PROZENT = 100;

export function bossDaten(k: Kampf, f: Figur): BossDef {
  return k.content.bossById[f.boss!.bossId];
}

/** Schaden eines Bossangriffs vor Mitigation: Anteil RefLeben × M(n) × Kampfstufe × Raserei (10.4, 10.1). */
export function bossSchaden(k: Kampf, f: Figur, pctRefHp: number): number {
  const z = f.boss!;
  return (pctRefHp / PROZENT) * refLife(k.content.balance, bossDaten(k, f).chapter) * z.schadenMult * (1 + z.raserei);
}

/** Ein Treffer des Bosses; physische Angriffe zählen als physisch, alle anderen mit seinem Element. */
export function bossTrifft(k: Kampf, boss: Figur, held: Figur, a: Attack): number {
  if (held.tot || unverwundbar(held)) return 0;
  const element = a.dmgType === 'phys' ? 'physisch' : boss.element;
  return gegnerTrifft(k, boss, held, bossSchaden(k, boss, a.pctRefHp), element);
}

export function lebendeHelden(k: Kampf): Figur[] {
  return lebende(k, 'held');
}
