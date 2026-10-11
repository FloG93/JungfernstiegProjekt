// Aufbauhilfen für die Tests des Rundenkerns. Kein Testlauf, nur gemeinsame Bausteine.
import type { BossId, ClassId } from '../content/ids';
import { referenceHero } from '../reference';
import { testContent } from '../testing';
import { kampfAnlegen } from './kampf';
import type { HeldAufstellung, KampfOptionen } from './kampf';
import type { Figur, Kampf } from './typen';

export const inhalt = testContent();

export function testHeld(klasse: ClassId, stufe = 10, i = 0, alleAutocast = false): HeldAufstellung {
  const setup = referenceHero(inhalt, klasse, stufe, { index: i, allAutocast: alleAutocast });
  return {
    dbId: i + 1, spielerId: `p${i}`, name: `${klasse}-${i}`, klasse, stufe,
    werte: setup.sets[setup.activeSet].stats, element: setup.sets[setup.activeSet].element,
    autocast: {}, autoTrank: true,
  };
}

export function testKampf(o: Partial<KampfOptionen> & { helden: HeldAufstellung[] }): Kampf {
  return kampfAnlegen({
    content: inhalt, seed: 7, stage: 10, gegner: [{ typ: 'scherge', stufe: 10, n: 2, kapitel: 2 }], ...o,
  });
}

const BOSS_KLASSEN = ['krieger', 'magier', 'waldlaeufer', 'schurke', 'kleriker', 'runenweber'] as const;

/** Bosskampf mit einer vollen Party auf der empfohlenen Stufe der Boss-Stage. */
export function testBossKampf(bossId: BossId, n = 6, seed = 3, kampfstufe = 0): Kampf {
  const stage = inhalt.stages.find((s) => s.boss === bossId);
  const stufe = stage?.recommendedLevel ?? 10;
  return kampfAnlegen({
    content: inhalt, seed, stage: stage?.stage ?? 10, gegner: [],
    helden: BOSS_KLASSEN.slice(0, n).map((kl, i) => testHeld(kl, stufe, i, true)),
    boss: { bossId, n, kampfstufe },
  });
}

export function bossVon(k: Kampf): Figur {
  const f = k.figuren.find((x) => x.art === 'boss');
  if (!f) throw new Error('Kein Boss im Kampf');
  return f;
}

export function heldVon(k: Kampf, klasse: ClassId): Figur {
  const f = k.figuren.find((x) => x.klasse === klasse);
  if (!f) throw new Error(`Held ${klasse} fehlt im Kampf`);
  return f;
}

export function gegnerVon(k: Kampf, i = 0): Figur {
  const f = k.figuren.filter((x) => x.seite === 'gegner')[i];
  if (!f) throw new Error(`Gegner ${i} fehlt im Kampf`);
  return f;
}

/** Macht eine Figur praktisch unverwundbar, damit ein Test nicht vorzeitig endet. */
export function dickes(f: Figur, lp = 1_000_000): void {
  f.maxLp = lp;
  f.lp = lp;
}
