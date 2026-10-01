// Fährtenleser (4.7): Abklingzeit der Ausweichrolle 7 s.
import { numParam } from '../heroutil';
import type { HandlerModule } from './types';

export const rollCooldown: HandlerModule = {
  id: 'rollCooldown',
  rollCooldownS: (params) => numParam(params, 'cooldownS'),
};
