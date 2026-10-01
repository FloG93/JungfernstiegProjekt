// Umgebungsgefahr Schattenzonen (9.8). Form und Zusatzwirkung stehen in levels/hazards.json (OPEN-006).
import { spawnHazard } from './hazardCommon';
import type { HandlerModule } from './types';

export const hazard_schattenzone: HandlerModule = {
  id: 'hazard_schattenzone',
  hazard: spawnHazard,
};
