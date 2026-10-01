// Gemeinsamer Ablauf der Umgebungsgefahren (9.8): 1,5 s Anzeige, 4 % RefLeben (Element des Kapitels,
// Resistenz mindert), Zusatzwirkung beim Treffer oder als Fläche, die eine Weile bleibt.
import type { HazardDef } from '../../content/schemas';
import { foeHit } from '../combat';
import { chapterElement } from '../enemies';
import { applyStatus } from '../status';
import type { World, Zone } from '../types';
import { PERCENT, degToRad, unitsInZone } from '../util';
import { addZone } from '../zones';

const VERTICAL_DEG = 90;

export function spawnHazard(w: World, def: HazardDef, x: number, y: number): void {
  const st = w.content.balance.stage.hazard;
  const element = chapterElement(w.content, def.chapter);
  const amount = (st.pctRefHp / PERCENT) * w.scenario.refLife(w);
  const level = w.scenario.attackerLevel(w);
  const depth = w.content.engine.world.bandDepthPx;
  const vertical = def.orientation === 'vertical';
  const shape = def.shape === 'circle'
    ? { shape: 'circle' as const, w: def.radiusPx ?? 0, h: def.radiusPx ?? 0 }
    : { shape: 'line' as const, w: def.lengthPx ?? 0, h: def.widthPx ?? 0, ang: vertical ? degToRad(VERTICAL_DEG) : 0 };
  const zy = vertical ? depth / 2 : y;
  addZone(w, {
    kind: 'hazard', ...shape, x, y: zy, endsAt: w.t + st.telegraphMs, affects: 'hero', srcId: 0, label: def.id,
    onEnd: (ww, z) => {
      for (const h of unitsInZone(ww, z)) {
        if (h.statuses.some((s) => s.id === 'unverwundbar')) continue;
        foeHit(ww, null, h, { amount, physical: false, element, attackerLevel: level });
        const hs = def.hitStatus;
        if (hs) applyStatus(ww, null, h, hs.id, opts(hs, level));
      }
      const lg = def.linger;
      if (!lg) return;
      addZone(ww, {
        kind: 'aura', shape: z.shape, x: z.x, y: z.y, w: z.w, h: z.h, ...(z.ang !== undefined ? { ang: z.ang } : {}),
        endsAt: ww.t + lg.ms, affects: 'hero', srcId: 0, label: `${def.id}_flaeche`, tickMs: lg.tickMs,
        onTick: (w3: World, lz: Zone) => {
          for (const h of unitsInZone(w3, lz)) applyStatus(w3, null, h, lg.status.id, opts(lg.status, level));
        },
      });
    },
  });
}

function opts(s: { ms: number; stacks?: number; value?: number }, attackerLevel: number) {
  const o: { ms: number; stacks?: number; value?: number; attackerLevel: number } = { ms: s.ms, attackerLevel };
  if (s.stacks !== undefined) o.stacks = s.stacks;
  if (s.value !== undefined) o.value = s.value;
  return o;
}
