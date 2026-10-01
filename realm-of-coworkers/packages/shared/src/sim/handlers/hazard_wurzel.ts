// Umgebungsgefahr Wurzelausbrüche (9.8). Form und Zusatzwirkung stehen in levels/hazards.json (OPEN-006).
import { spawnHazard } from './hazardCommon';
import type { HandlerModule } from './types';

export const hazard_wurzel: HandlerModule = {
  id: 'hazard_wurzel',
  hazard: spawnHazard,
};
