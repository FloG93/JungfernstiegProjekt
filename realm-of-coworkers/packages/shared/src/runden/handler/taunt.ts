// Spott (4.1, 6.6): Die getroffenen Gegner greifen bis zum Ablauf den Spötter an.
// Bosse lassen sich nicht zwingen, bekommen aber den Bedrohungsbonus aus den Daten (10.3).
import { rundenAusMs } from '../umrechnung';
import { bedrohungAddieren } from '../wirkung';
import type { HandlerKontext } from './index';

const PROZENT = 100;

export function taunt({ k, von, ziele, params }: HandlerKontext): void {
  const runden = rundenAusMs(k.content, Number(params['ms'] ?? 0));
  const bonusPct = Number(params['bossThreatBonusPct'] ?? 0);
  for (const g of ziele) {
    if (g.seite !== 'gegner' || g.tot) continue;
    if (g.art === 'boss') {
      const hoechste = Math.max(0, ...[...g.bedrohung.values()]);
      bedrohungAddieren(k, g, von.id, Math.max(0, hoechste * (1 + bonusPct / PROZENT) - (g.bedrohung.get(von.id) ?? 0)));
      continue;
    }
    g.spottVon = von.id;
    g.spottBisRunde = k.runde + runden;
    g.zielId = von.id;
  }
}
