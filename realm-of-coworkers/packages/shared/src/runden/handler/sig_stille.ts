// Nyxhara, Stille (10.6): Lichtkreise schützen, wer darin steht. Ohne Fläche gilt als geschützt, wer
// in dieser Runde verteidigt oder einen Schild trägt; alle anderen treffen Schaden und Furcht (OPEN-061).
import { bossTrifft, lebendeHelden } from '../bosswirkung';
import { statusSetzen } from '../status';
import type { Figur } from '../typen';
import type { BossHandler } from './bosstypen';
import { zahl } from './bosstypen';

export const sig_stille: BossHandler = {
  signatur({ k, boss, params, angriff }) {
    const getroffen: Figur[] = [];
    for (const h of lebendeHelden(k)) {
      if (h.verteidigt || h.schilde.length > 0) continue;
      if (bossTrifft(k, boss, h, angriff) <= 0) continue;
      getroffen.push(h);
      statusSetzen(k, h, { id: 'furcht', ms: zahl(params, 'fearMs'), quelleId: boss.id });
    }
    return getroffen;
  },
};
