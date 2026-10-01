// Artefakt-Effekte (7.7, 15.5): ändern einen Datenwert nur für den Träger.
// Pfade: skill:<id>.cooldownS, skill:<id>.effects.<i>.<feld>, handler:<skillId>.<param>,
// balance.<pfad> (nur E-016) und self.buffDurationMs (E-015).
import type { SkillDef } from '../../content/schemas';
import type { HeroBalance } from '../types';
import type { HandlerModule, Params } from './types';

export const modifyValue: HandlerModule = { id: 'modifyValue' };

const BALANCE_KEYS: Record<string, keyof HeroBalance> = {
  'combat.potion.pct': 'potionPct',
  'combat.potion.cooldownS': 'potionCooldownS',
  'combat.roll.px': 'rollPx',
  'combat.roll.cooldownS': 'rollCooldownS',
  'combat.revive.channelS': 'reviveChannelS',
};

function op(current: number, params: Params): number {
  if (typeof params['set'] === 'number') return params['set'];
  if (typeof params['add'] === 'number') return current + params['add'];
  if (typeof params['mult'] === 'number') return current * params['mult'];
  return current;
}

export interface ModTarget {
  defs: Map<string, SkillDef>;
  balance: HeroBalance;
  buffDurationAddMs: number;
}

/** Wendet einen modifyValue-Effekt an. Unbekannte Pfade werfen (der Loader prüft sie vorab). */
export function applyModifyValue(t: ModTarget, params: Params): void {
  const path = params['path'];
  if (typeof path !== 'string') throw new Error('modifyValue ohne path');
  if (path === 'self.buffDurationMs') {
    t.buffDurationAddMs = op(t.buffDurationAddMs, params);
    return;
  }
  if (path.startsWith('balance.')) {
    const key = BALANCE_KEYS[path.slice('balance.'.length)];
    if (!key) throw new Error(`modifyValue: Pfad ${path} nicht erlaubt`);
    t.balance[key] = op(t.balance[key], params);
    return;
  }
  const m = /^(skill|handler):([a-z_]+)\.(.+)$/.exec(path);
  if (!m) throw new Error(`modifyValue: Pfad ${path} unbekannt`);
  const kind = m[1];
  const def = t.defs.get(m[2]!);
  const rest = m[3]!;
  if (!def) throw new Error(`modifyValue: Fähigkeit ${m[2]} fehlt`);
  if (kind === 'skill') {
    if (rest === 'cooldownS') {
      def.cooldownS = op(def.cooldownS, params);
      return;
    }
    const em = /^effects\.(\d+)\.([a-zA-Z]+)$/.exec(rest);
    const eff = em ? (def.effects[Number(em[1])] as unknown as Record<string, unknown> | undefined) : undefined;
    if (!em || !eff || typeof eff[em[2]!] !== 'number') throw new Error(`modifyValue: Feld ${rest} fehlt`);
    eff[em[2]!] = op(eff[em[2]!] as number, params);
    return;
  }
  const h = def.effects.find((e) => e.k === 'handler');
  if (!h || h.k !== 'handler' || typeof h.params[rest] !== 'number') throw new Error(`modifyValue: Parameter ${rest} fehlt`);
  h.params[rest] = op(h.params[rest] as number, params);
}
