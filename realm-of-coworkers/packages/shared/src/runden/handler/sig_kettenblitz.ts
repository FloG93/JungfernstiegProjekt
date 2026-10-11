// Voltrax, Kettenblitz (10.6): springt bis zu 5-mal zwischen den Helden. Ohne Abstände springt er in
// der Reihenfolge der Initiative weiter, beginnend bei einem zufälligen Helden (OPEN-061).
import { bossTrifft, lebendeHelden } from '../bosswirkung';
import { statusSetzen } from '../status';
import type { Figur } from '../typen';
import { initiative } from '../werte';
import type { BossHandler } from './bosstypen';
import { zahl } from './bosstypen';

export const sig_kettenblitz: BossHandler = {
  signatur({ k, boss, params, angriff }) {
    const lebend = [...lebendeHelden(k)].sort((a, b) => initiative(k, b) - initiative(k, a) || a.id - b.id);
    if (lebend.length === 0) return [];
    const start = lebend.indexOf(k.rng.pick(lebend));
    const getroffen: Figur[] = [];
    for (let i = 0; i < zahl(params, 'jumps'); i++) {
      const ziel = lebend[(start + i) % lebend.length]!;
      if (ziel.tot) continue;
      if (bossTrifft(k, boss, ziel, angriff) > 0 && !getroffen.includes(ziel)) getroffen.push(ziel);
    }
    for (const h of getroffen) {
      if (!h.tot) statusSetzen(k, h, { id: 'schock', ms: zahl(params, 'shockMs'), quelleId: boss.id });
    }
    return getroffen;
  },
};
