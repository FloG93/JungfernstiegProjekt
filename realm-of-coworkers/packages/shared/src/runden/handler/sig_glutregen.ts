// Ignarch, Glutregen (10.6): 8 Feuersäulen schlagen ein. Ohne Fläche treffen sie je einen zufällig
// gewählten Helden; ein Held kann mehrfach getroffen werden (OPEN-061).
import { bossTrifft, lebendeHelden } from '../bosswirkung';
import type { Figur } from '../typen';
import type { BossHandler } from './bosstypen';
import { zahl } from './bosstypen';

export const sig_glutregen: BossHandler = {
  signatur({ k, boss, params, angriff }) {
    const getroffen: Figur[] = [];
    for (let i = 0; i < zahl(params, 'pillars'); i++) {
      const lebend = lebendeHelden(k);
      if (lebend.length === 0) break;
      const ziel = k.rng.pick(lebend);
      if (bossTrifft(k, boss, ziel, angriff) > 0 && !getroffen.includes(ziel)) getroffen.push(ziel);
    }
    return getroffen;
  },
};
