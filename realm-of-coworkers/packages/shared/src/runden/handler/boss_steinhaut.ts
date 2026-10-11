// Gorthul, Steinhaut (10.6): physischer Schaden −25 %, multiplikativ zur Rüstung.
import type { BossHandler } from './bosstypen';
import { zahl } from './bosstypen';

const PROZENT = 100;

export const boss_steinhaut: BossHandler = {
  start({ boss, params }) {
    boss.boss!.einMultPhys = Math.max(0, 1 - zahl(params, 'physDamageMalusPct') / PROZENT);
  },
};
