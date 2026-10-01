// Gegner-KI (6.6, 9.3). Wird in M3 (Gegner) und M4 (Bosse) ausgebaut.
import type { World } from './types';

export function updateFoes(w: World): void {
  for (const u of w.units) {
    if (u.dead || !u.foe || u.foe.ai === 'dummy') continue;
  }
}
