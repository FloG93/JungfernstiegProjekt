// Glaciara, Eispanzer (10.6): Schild in Höhe von 2 % Boss-Leben, erneuert sich alle 45 s (15 Runden).
import { schildGeben } from '../wirkung';
import { rundenAusSekunden } from '../umrechnung';
import type { BossHandler } from './bosstypen';
import { zahl } from './bosstypen';

const PROZENT = 100;

function panzern(k: Parameters<NonNullable<BossHandler['start']>>[0]['k'],
  boss: Parameters<NonNullable<BossHandler['start']>>[0]['boss'], params: Record<string, number>): void {
  const runden = rundenAusSekunden(k.content, zahl(params, 'renewS'));
  boss.schilde = [];
  schildGeben(k, boss, (boss.maxLp * zahl(params, 'pctMaxHp')) / PROZENT, runden);
  boss.boss!.passivRest = runden;
}

export const boss_eispanzer: BossHandler = {
  start: ({ k, boss, params }) => panzern(k, boss, params),
  runde({ k, boss, params }) {
    boss.boss!.passivRest -= 1;
    if (boss.boss!.passivRest > 0) return;
    panzern(k, boss, params);
  },
};
