// Läuterung (4.5): entfernt je Verbündetem eine festgelegte Anzahl schwächender Effekte (7.7).
import { reinigen } from '../status';
import type { HandlerKontext } from './index';

export function cleanse({ k, ziele, params }: HandlerKontext): void {
  const jeVerbuendetem = Number(params['perAlly'] ?? 1);
  for (const f of ziele) {
    if (f.seite !== 'held' || f.tot) continue;
    reinigen(k, f, jeVerbuendetem);
  }
}
