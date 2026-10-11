// Wunder (4.5): belebt gefallene Verbündete mit einem Anteil ihres Lebens wieder.
import { melde } from '../typen';
import type { HandlerKontext } from './index';

const PROZENT = 100;

export function revive({ k, von, params }: HandlerKontext): void {
  const pct = Number(params['pct'] ?? 0);
  for (const f of k.figuren) {
    if (f.seite !== von.seite || !f.tot) continue;
    f.tot = false;
    f.lp = Math.max(1, Math.round((f.maxLp * pct) / PROZENT));
    melde(k, { e: 'heilung', von: von.id, an: f.id, menge: f.lp });
  }
}
