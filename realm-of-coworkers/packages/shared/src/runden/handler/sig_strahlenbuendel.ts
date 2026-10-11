// Solaris, Strahlenbündel (10.6): drei Lichtlinien. Ohne Fläche trifft jede Linie einen Helden;
// solange genug Helden stehen, ist jeder höchstens einmal betroffen (OPEN-061).
import { bossTrifft, lebendeHelden } from '../bosswirkung';
import type { Figur } from '../typen';
import type { BossHandler } from './bosstypen';
import { zahl } from './bosstypen';

export const sig_strahlenbuendel: BossHandler = {
  signatur({ k, boss, params, angriff }) {
    const offen = [...lebendeHelden(k)];
    const getroffen: Figur[] = [];
    for (let i = 0; i < zahl(params, 'beams'); i++) {
      const topf = offen.length > 0 ? offen : lebendeHelden(k);
      if (topf.length === 0) break;
      const ziel = k.rng.pick(topf);
      const stelle = offen.indexOf(ziel);
      if (stelle >= 0) offen.splice(stelle, 1);
      if (bossTrifft(k, boss, ziel, angriff) > 0 && !getroffen.includes(ziel)) getroffen.push(ziel);
    }
    return getroffen;
  },
};
