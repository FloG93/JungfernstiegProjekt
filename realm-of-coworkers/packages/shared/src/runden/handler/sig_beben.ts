// Gorthul, Beben (10.6): trifft die ganze Party und betäubt. Radius 300 px heißt nach der
// Umrechnungstabelle (ENTWURF 2.2) alle Gegner des Bosses, also alle Helden (OPEN-061).
import { bossTrifft, lebendeHelden } from '../bosswirkung';
import { statusSetzen } from '../status';
import type { Figur } from '../typen';
import type { BossHandler } from './bosstypen';
import { zahl } from './bosstypen';

export const sig_beben: BossHandler = {
  signatur({ k, boss, params, angriff }) {
    const getroffen: Figur[] = [];
    for (const h of lebendeHelden(k)) {
      if (bossTrifft(k, boss, h, angriff) <= 0) continue;
      getroffen.push(h);
      statusSetzen(k, h, { id: 'betaeubung', ms: zahl(params, 'stunMs'), quelleId: boss.id });
    }
    return getroffen;
  },
};
