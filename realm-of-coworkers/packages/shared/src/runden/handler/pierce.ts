// Durchschlag (4.3): Der Schuss trifft das Ziel voll und die Figur dahinter anteilig.
// „Dahinter" heißt ohne Bewegung: dieselbe Seite, die andere Reihe (ENTWURF 2.2).
import { gegnerSeite } from '../typen';
import { heldTrifft } from '../wirkung';
import { reihe } from '../ziele';
import type { HandlerKontext } from './index';

const PROZENT = 100;

export function pierce({ k, von, ziele, params }: HandlerKontext): void {
  const coef = Number(params['coef'] ?? 0);
  const zweitPct = Number(params['secondaryPct'] ?? 0);
  const ziel = ziele[0];
  if (!ziel) return;
  heldTrifft(k, von, ziel, coef, von.element);
  const hinten = reihe(k, gegnerSeite(von.seite), ziel.reihe === 'vorn' ? 'hinten' : 'vorn');
  const dahinter = hinten.find((f) => f.id !== ziel.id);
  if (dahinter && zweitPct > 0) heldTrifft(k, von, dahinter, (coef * zweitPct) / PROZENT, von.element);
}
