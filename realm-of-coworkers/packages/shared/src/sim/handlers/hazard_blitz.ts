// Umgebungsgefahr Blitzeinschläge (9.8). Form und Zusatzwirkung stehen in levels/hazards.json (OPEN-006).
import { spawnHazard } from './hazardCommon';
import type { HandlerModule } from './types';

export const hazard_blitz: HandlerModule = {
  id: 'hazard_blitz',
  hazard: spawnHazard,
};
