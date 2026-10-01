// Umgebungsgefahr Feuersäulen (9.8). Form und Zusatzwirkung stehen in levels/hazards.json (OPEN-006).
import { spawnHazard } from './hazardCommon';
import type { HandlerModule } from './types';

export const hazard_feuersaeule: HandlerModule = {
  id: 'hazard_feuersaeule',
  hazard: spawnHazard,
};
