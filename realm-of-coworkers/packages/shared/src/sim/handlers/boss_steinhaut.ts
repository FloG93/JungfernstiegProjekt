// Gorthul, Steinhaut (10.6): physischer Schaden −25 % (multiplikativ zur Rüstung).
import { numParam } from '../heroutil';
import { PERCENT } from '../util';
import type { HandlerModule } from './types';

export const boss_steinhaut: HandlerModule = {
  id: 'boss_steinhaut',
  incomingMult: (params, physical) => (physical ? 1 - numParam(params, 'physDamageMalusPct') / PERCENT : 1),
};
