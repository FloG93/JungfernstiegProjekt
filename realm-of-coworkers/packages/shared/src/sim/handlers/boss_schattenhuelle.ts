// Nyxhara, Schattenhülle (10.6): Elementarschaden −10 % (multiplikativ zur Resistenz).
import { numParam } from '../heroutil';
import { PERCENT } from '../util';
import type { HandlerModule } from './types';

export const boss_schattenhuelle: HandlerModule = {
  id: 'boss_schattenhuelle',
  incomingMult: (params, physical) => (physical ? 1 : 1 - numParam(params, 'elemDamageMalusPct') / PERCENT),
};
