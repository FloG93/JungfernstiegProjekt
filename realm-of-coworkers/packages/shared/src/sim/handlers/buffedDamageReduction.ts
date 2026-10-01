// Resonanz (4.10): Verbündete unter einem Buff des Runenwebers erleiden 5 % weniger Schaden.
// Die Wirkung steht in effstats.ts (dmgTakenMult), der Handler trägt nur die Parameter.
import type { HandlerModule } from './types';

export const buffedDamageReduction: HandlerModule = { id: 'buffedDamageReduction' };
