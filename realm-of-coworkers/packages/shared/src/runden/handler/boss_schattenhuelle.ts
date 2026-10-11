// Nyxhara, Schattenhülle (10.6): Elementarschaden −10 %, multiplikativ zur Resistenz.
import type { BossHandler } from './bosstypen';
import { zahl } from './bosstypen';

const PROZENT = 100;

export const boss_schattenhuelle: BossHandler = {
  start({ boss, params }) {
    boss.boss!.einMultElem = Math.max(0, 1 - zahl(params, 'elemDamageMalusPct') / PROZENT);
  },
};
