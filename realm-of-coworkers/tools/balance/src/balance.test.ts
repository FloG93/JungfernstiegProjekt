// Abnahme M10 (13.11): Der Port trifft alle festen Ausgaben von ref_model.py, ist grün auf den Daten der
// Spezifikation und rot, wenn eine Konstante verändert wird.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadContentFromDir } from '@aethra/shared/node';
import type { Content } from '@aethra/shared';
import { describe, expect, it } from 'vitest';
import { runChecks } from './checks';
import { Model } from './model';
import { buildReport } from './report';

const content = loadContentFromDir();
const refScript = fileURLToPath(new URL('../reference/ref_model.py', import.meta.url));
const py = spawnSync('python3', [refScript], { encoding: 'utf8' });
const hasPython = py.status === 0;
const numbers = (s: string) => [...s.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

describe('pnpm balance', () => {
  it.skipIf(!hasPython)('trifft alle festen Ausgaben von ref_model.py auf die angezeigte Stelle', () => {
    const ts = buildReport(new Model(content)).lines;
    const ref = py.stdout.split('\n').filter((l) => l.trim().length > 0);
    expect(ts.length).toBe(ref.length);
    ref.forEach((want, i) => {
      const got = ts[i]!;
      if (want.startsWith('13.5 Zufall') || want.startsWith('12.9')) {
        // Zufallsteile: anderer Generator, Mittelwerte ±2 s bzw. ±0,01 (13.11)
        const a = numbers(got);
        const b = numbers(want);
        expect(a.length).toBe(b.length);
        const tol = want.startsWith('12.9') ? 0.0101 : 5;
        a.forEach((x, k) => expect(Math.abs(x - b[k]!), `${want} ↔ ${got}`).toBeLessThanOrEqual(k === 1 && want.startsWith('13.5') ? 2 : tol));
      } else {
        expect(got).toBe(want);
      }
    });
  });

  it('alle Grenzen aus 13.9 sind auf den Daten der Spezifikation erfüllt', () => {
    const failed = runChecks(buildReport(new Model(content))).filter((c) => !c.ok);
    expect(failed).toEqual([]);
  });

  const variants: [string, (c: Content) => void][] = [
    ['Boss-Leben Kapitel 3 +60 %', (c) => {
      c.bosses[2]!.hpBase *= 1.6;
    }],
    ['Gegner-Schaden je Stufe ×1,8', (c) => {
      c.balance.enemy.damage.perLevel *= 1.8;
    }],
    ['Gold je Basispunkt ×1,3', (c) => {
      c.balance.gold.stage.perPoint *= 1.3;
    }],
    ['Einzelkämpfer-Faktor Kleriker 1,5', (c) => {
      c.classById.kleriker.solo = 1.5;
    }],
    ['Boss-Stages ohne XP', (c) => {
      c.balance.progression.xpFactors.bossFirst = 0;
      c.balance.progression.xpFactors.bossStageEncounters = 0;
    }],
    ['Boss-Schaden Grundwert 0,4', (c) => {
      c.balance.boss.damage.base = 0.4;
    }],
    ['Signatur von Gorthul 150 % RefLeben', (c) => {
      c.bosses[3]!.attacks.signature.pctRefHp = 150;
    }],
    ['Seltenheit Episch ×1,9', (c) => {
      c.balance.items.rarity.episch = 1.9;
    }],
  ];
  it.each(variants)('rot bei veränderter Konstante: %s', (_name, change) => {
    const c = structuredClone(content);
    change(c);
    const failed = runChecks(buildReport(new Model(c))).filter((x) => !x.ok);
    expect(failed.length).toBeGreaterThan(0);
  });
});
