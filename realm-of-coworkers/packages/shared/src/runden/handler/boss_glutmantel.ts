// Ignarch, Glutmantel (10.6): Wer vorn steht, bekommt jede Runde Verbrennung.
// Aus dem Umkreis von 120 px wird nach der Umrechnungstabelle (ENTWURF 2.2) die vordere Heldenreihe (OPEN-061).
import { statusSetzen } from '../status';
import { reihe } from '../ziele';
import type { BossHandler } from './bosstypen';
import { zahl } from './bosstypen';

export const boss_glutmantel: BossHandler = {
  runde({ k, boss, params }) {
    for (const h of reihe(k, 'held', 'vorn')) {
      statusSetzen(k, h, {
        id: 'verbrennung', ms: k.content.statusById['verbrennung']!.defaultMs,
        stapel: zahl(params, 'stacks'), quelleId: boss.id,
      });
    }
  },
};
