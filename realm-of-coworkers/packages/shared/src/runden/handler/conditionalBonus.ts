// Meucheln (4.4): mehr Schaden gegen Ziele, die bereits einen schwächenden Effekt tragen.
import type { StatusId } from '../../content/ids';
import { heldTrifft } from '../wirkung';
import { hatStatus } from '../werte';
import type { HandlerKontext } from './index';

export function conditionalBonus({ k, von, ziele, params }: HandlerKontext): void {
  const coef = Number(params['coef'] ?? 0);
  const mult = Number(params['mult'] ?? 1);
  const ids = String(params['statuses'] ?? '').split(',').map((s) => s.trim()).filter(Boolean) as StatusId[];
  const auchGeschwaecht = params['orWeakened'] === true;
  for (const ziel of ziele) {
    const trifftZu = ids.some((id) => hatStatus(ziel, id))
      || (auchGeschwaecht && ziel.status.some((s) => (k.content.statusById[s.id]?.cleanseOrder ?? 0) > 0));
    heldTrifft(k, von, ziel, coef, von.element, { bonusMult: trifftZu ? mult : 1 });
  }
}
