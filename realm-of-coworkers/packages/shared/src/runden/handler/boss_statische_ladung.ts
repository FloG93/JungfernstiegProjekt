// Voltrax, Statische Ladung (10.6): alle 30 s (10 Runden) für 8 s (3 Runden) Raserei.
import { statusSetzen } from '../status';
import { rundenAusSekunden } from '../umrechnung';
import type { BossHandler } from './bosstypen';
import { zahl } from './bosstypen';

export const boss_statische_ladung: BossHandler = {
  start({ k, boss, params }) {
    boss.boss!.passivRest = rundenAusSekunden(k.content, zahl(params, 'everyS'));
  },
  runde({ k, boss, params }) {
    const z = boss.boss!;
    z.passivRest -= 1;
    if (z.passivRest > 0) return;
    z.passivRest = rundenAusSekunden(k.content, zahl(params, 'everyS'));
    statusSetzen(k, boss, { id: 'raserei', ms: zahl(params, 'ms') });
  },
};
