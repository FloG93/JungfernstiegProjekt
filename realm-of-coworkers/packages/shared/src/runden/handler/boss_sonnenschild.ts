// Solaris, Sonnenschild (10.6): Schild in Höhe von 3 % Boss-Leben zu Beginn jeder Phase.
import { schildGeben } from '../wirkung';
import type { BossHandler } from './bosstypen';
import { zahl } from './bosstypen';

const PROZENT = 100;

export const boss_sonnenschild: BossHandler = {
  phase({ k, boss, params }) {
    boss.schilde = [];
    // Der Schild hält bis zum Phasenende; länger als ein Kampf dauern kann, gibt es nicht
    schildGeben(k, boss, (boss.maxLp * zahl(params, 'pctMaxHp')) / PROZENT, k.content.runden.maxRunden);
  },
};
