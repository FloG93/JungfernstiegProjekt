// Glaciara, Frostnova (10.6): Kreis um den Boss. Nach der Umrechnung (ENTWURF 2.2) trifft er die
// vordere Heldenreihe; wer hinten steht, bleibt verschont (OPEN-061).
import { bossTrifft } from '../bosswirkung';
import { statusSetzen } from '../status';
import type { Figur } from '../typen';
import { reihe } from '../ziele';
import type { BossHandler } from './bosstypen';
import { zahl } from './bosstypen';

export const sig_frostnova: BossHandler = {
  signatur({ k, boss, params, angriff }) {
    const getroffen: Figur[] = [];
    for (const h of reihe(k, 'held', 'vorn')) {
      if (bossTrifft(k, boss, h, angriff) <= 0) continue;
      getroffen.push(h);
      statusSetzen(k, h, {
        id: 'frost', ms: k.content.statusById['frost']!.defaultMs,
        stapel: zahl(params, 'frostStacks'), quelleId: boss.id,
      });
    }
    return getroffen;
  },
};
