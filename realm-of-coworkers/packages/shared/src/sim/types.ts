// Typen der deterministischen Simulation (2.3, 11.7, 15.4).
import type {
  BossId, ClassId, ElementId, EnemyId, HandlerId, SkillSlot, StatId, StatusId,
} from '../content/ids';
import type { Content } from '../content/loader';
import type { BuffStat, SkillDef } from '../content/schemas';
import type { Rng } from '../rng';
import type { StatBlock } from '../stats';

export type Side = 'hero' | 'foe';
export type BossPhase = 1 | 2 | 3;
export type UnitKind = 'hero' | 'enemy' | 'boss' | 'add';
export type UnitState = 'idle' | 'walk' | 'attack' | 'cast' | 'roll' | 'stun' | 'dead';
export type WeaponSet = 'A' | 'B';

export interface Vec {
  x: number;
  y: number;
}

/** Ein Wertänderer eines Buffs, zum Beispiel Kraft ×1,15 (15.5, Effekt buff). */
export interface BuffMod {
  stat: BuffStat;
  mult?: number;
  add?: number;
}

export interface StatusInst {
  id: StatusId;
  stacks: number;
  appliedAt: number;
  endsAt: number;
  srcId: number;
  /** Überschreibt einen Parameter aus status.json (E-009). */
  value?: number;
  /** Schaden oder Heilung je Stapel und Tick, beim Anwenden festgehalten. */
  perStackTick?: number;
  nextTickAt?: number;
  /** Wertänderer bei Buffs (Kraftrune, Adlerauge, Bollwerk …). */
  mods?: BuffMod[];
  /** Quelle ist ein Held (für Schaden über Zeit und Resonanz). */
  fromHero?: boolean;
  /** Klasse der Quelle (Resonanz des Runenwebers, 4.10). */
  srcClass?: ClassId;
  /** Angreiferstufe für Schaden über Zeit aus Gegnerquellen (5.6). */
  attackerLevel?: number;
}

export interface ShieldInst {
  amount: number;
  createdAt: number;
  endsAt: number;
  srcId: number;
  /** Herkunft, zum Beispiel 'gnade' (Kleriker-Passiv) oder 'waechter' (Gegner-Schild). */
  tag?: string;
}

export interface WeaponInfo {
  /** Werte des Helden mit diesem Waffensatz, vor Buffs und Obergrenzen (immer vorhanden, auch ohne Waffe). */
  stats: StatBlock;
  /** Liegt in diesem Satz eine Waffe (8.6)? Ohne Waffe ist der Wechsel gesperrt. */
  hasWeapon: boolean;
  element: ElementId;
  /** Bosswaffe: ID des Bosses mit festem Effekt (8.5). */
  effectBoss: BossId | null;
  itemId?: number;
}

export interface HeroSkill {
  def: SkillDef;
  slot: SkillSlot;
  /** Verbleibende Abklingzeit in ms (läuft mit Tempo und Schock, 4.4, 6.3). */
  cdLeft: number;
  autocast: boolean;
}

export interface HeroBalance {
  potionPct: number;
  potionCooldownS: number;
  rollPx: number;
  rollCooldownS: number;
  reviveChannelS: number;
}

export interface HeroInputState {
  mx: number;
  my: number;
  /** Zielpunkt bei Klick auf den Boden (6.5). */
  moveTo: Vec | null;
  lastInputAt: number;
}

export interface HeroComp {
  playerId: string;
  dbId: number;
  name: string;
  classId: ClassId;
  level: number;
  appearance: unknown;
  sets: Record<WeaponSet, WeaponInfo>;
  activeSet: WeaponSet;
  swapUntil: number;
  swapLockUntil: number;
  skills: HeroSkill[];
  balance: HeroBalance;
  buffDurationAddMs: number;
  potionCharges: number;
  potionReadyAt: number;
  autoPotion: boolean;
  rollReadyAt: number;
  rollUntil: number;
  rollDir: Vec;
  focusId: number | null;
  input: HeroInputState;
  /** Manuell bewegt bis zu diesem Zeitpunkt, danach Rückkehr in die Formation (6.5). */
  manualUntil: number;
  formationOffsetX: number;
  formationOffsetY: number;
  connected: boolean;
  disconnectedAt: number;
  reviveTargetId: number | null;
  reviveDoneAt: number;
  /** Bonus des nächsten Treffers aus Tarnung (Schattenschritt). */
  nextHitBonusPct: number;
  elementarflussReadyAt: number;
  trapIds: number[];
  /** Einzelkämpfer-Multiplikator (4.4), nur bei n = 1. */
  soloMult: number;
  /** Dauerhafter Bewegungs-Multiplikator aus dem Passiv (Fährtenleser). */
  passiveMoveMult: number;
  /** Ausweichrolle aus dem Passiv (rollCooldown), sonst aus balance. */
  rollCooldownS: number;
  /** Zähler für Messungen (K, Schaden, Heilung). */
  meter: HeroMeter;
}

export interface HeroMeter {
  damage: number;
  healing: number;
  /** Summe der Koeffizienten (mit Bedingungs- und Krit-Faktor) für die Messung von K (13.2, M2). */
  kCoef: number;
  hits: number;
  deaths: number;
  damageTaken: number;
}

export interface FoeComp {
  type: EnemyId | 'boss';
  bossId?: BossId;
  /** Angreiferstufe für die Mitigation der Helden (5.6). */
  level: number;
  dmgPerHit: number;
  intervalMs: number;
  rangePx: number;
  speed: number;
  ai: 'melee' | 'ranged' | 'support' | 'bomber' | 'guardian' | 'boss' | 'dummy';
  attackCdLeft: number;
  /** Bedrohung je Held (6.6), Einfügereihenfolge deterministisch. */
  threat: Map<number, number>;
  targetId: number | null;
  tauntById: number | null;
  tauntUntil: number;
  weight: number;
  encounter: number;
  isElite: boolean;
  affix: HandlerId | null;
  physical: boolean;
  /** Zustand der Handler (Priester, Bomber, Wächter, Affixe, Großangriff). */
  hs: Record<string, number>;
  /** Wird bei Kampfende ohne Kill entfernt und zahlt seinen Anteil trotzdem (12.3). */
  rushing: boolean;
  spawnedAt: number;
  side: -1 | 1;
}

export interface Unit {
  id: number;
  kind: UnitKind;
  side: Side;
  x: number;
  y: number;
  face: -1 | 1;
  hp: number;
  maxHp: number;
  dead: boolean;
  state: UnitState;
  stateUntil: number;
  /** Element des Ziels (Gegner, Bosse) bzw. der aktiven Waffe (Helden). */
  element: ElementId;
  armorMit: number;
  resMit: number;
  statuses: StatusInst[];
  shields: ShieldInst[];
  hero?: HeroComp;
  foe?: FoeComp;
  /** Für Tests: Einheit nimmt keinen Schaden und stirbt nicht. */
  immortal?: boolean;
}

export type ZoneKind = 'telegraph' | 'hazard' | 'aura' | 'trap';

export interface Zone {
  id: number;
  kind: ZoneKind;
  shape: 'circle' | 'line' | 'cone';
  x: number;
  y: number;
  /** Kreis: Radius in w und h; Linie: Länge w, Breite h, Winkel ang. */
  w: number;
  h: number;
  ang?: number;
  createdAt: number;
  endsAt: number;
  /** Seite, die von der Zone betroffen ist. */
  affects: Side;
  srcId: number;
  /** Wird am Ende der Anzeige ausgeführt. */
  onEnd?: (w: World, z: Zone) => void;
  /** Wird alle tickMs ausgeführt, solange die Zone besteht. */
  onTick?: (w: World, z: Zone) => void;
  tickMs?: number;
  nextTickAt?: number;
  /** Folgt einer Einheit (Aura). */
  followId?: number;
  label?: string;
}

export type GameEvent =
  | { e: 'hit'; src: number; dst: number; dmg: number; crit?: boolean; el?: string; absorbed?: number; dot?: boolean }
  | { e: 'heal'; src: number; dst: number; amount: number }
  | { e: 'death'; id: number }
  | { e: 'revive'; id: number }
  | { e: 'cast'; id: number; skill: string; tx?: number; ty?: number; tid?: number }
  | { e: 'fx'; id: number; fx: string; add: boolean }
  | { e: 'telegraph'; zone: number; ms: number }
  | { e: 'phase'; boss: number; phase: BossPhase; el: string }
  | { e: 'encounter'; index: number; state: 'start' | 'end' }
  | { e: 'checkpoint'; index: number }
  | { e: 'loot'; kind: 'item' | 'gem' | 'splinter' | 'gold'; ref: object; heroId?: number }
  | { e: 'levelup'; heroId: number; level: number }
  | { e: 'chat'; from: number; text: string }
  | { e: 'ping'; from: number; kind: string; x: number; y: number }
  | { e: 'kill'; id: number; enemy: string; weight: number; encounter: number; elite: boolean }
  | { e: 'wipe'; checkpoint: number }
  | { e: 'stageEnd'; result: 'win' | 'abort' }
  | { e: 'bossText'; boss: number; text: string }
  | { e: 'potion'; id: number }
  | { e: 'roll'; id: number }
  | { e: 'swap'; id: number; set: WeaponSet };

export interface HeroSetup {
  /** Einheiten-ID wird von der Welt vergeben; dbId ist die Helden-ID der Datenbank. */
  dbId: number;
  playerId: string;
  name: string;
  classId: ClassId;
  level: number;
  appearance?: unknown;
  sets: Record<WeaponSet, WeaponInfo>;
  activeSet: WeaponSet;
  artifacts: { slot: 'amulett' | 'ring' | 'relikt'; rank: number }[];
  autocast: Record<string, boolean>;
  autoPotion: boolean;
}

export type HeroAction =
  | { k: 'skill'; id: string; target?: number; x?: number; y?: number }
  | { k: 'roll' }
  | { k: 'swap' }
  | { k: 'potion' }
  | { k: 'focus'; targetId: number | null }
  | { k: 'revive'; targetId: number };

export interface HeroInput {
  mx: number;
  my: number;
  /** Zielpunkt (Klick auf den Boden). */
  tx?: number;
  ty?: number;
  act?: HeroAction[];
}

export interface SimOptions {
  /** Alle Fähigkeiten feuern, sobald sie bereit sind (Modellannahme 13.1, nur Messung). */
  castAllWhenReady?: boolean;
}

/** Ablaufsteuerung (Stage, Arena oder Training). */
export interface Scenario {
  kind: 'training' | 'stage' | 'arena';
  /** Nach Bewegung, vor Fähigkeiten (11.7, Schritt 4). */
  update(w: World): void;
  /** Ankerposition für Formation und Autowalk (9.2). */
  anchor(w: World): Vec;
  /** Läuft gerade ein Kampf (Auto-Cast-Regel inCombat). */
  inCombat(w: World): boolean;
  /** Angreiferstufe normaler Gegner und Gefahren (5.6). */
  attackerLevel(w: World): number;
  /** RefLeben des Kapitels (13.3). */
  refLife(w: World): number;
  /** Wird gerufen, wenn eine Einheit stirbt. */
  onDeath?(w: World, u: Unit, killer: Unit | null): void;
  /** Breite der begehbaren Welt (Stage-Länge oder Arena-Breite). */
  bounds(w: World): { minX: number; maxX: number };
}

export interface World {
  content: Content;
  rng: Rng;
  seed: number;
  tick: number;
  /** Zeit in ms seit Start des Runs. */
  t: number;
  tickMs: number;
  nextId: number;
  units: Unit[];
  zones: Zone[];
  events: GameEvent[];
  removed: number[];
  scenario: Scenario;
  /** Gruppenstärke n für Spawns (11.4). */
  n: number;
  paused: boolean;
  opts: SimOptions;
  /** Kopien der Fähigkeiten je Held (Artefakte, modifyValue). */
  heroSkillDefs: Map<number, Map<string, SkillDef>>;
  boss: Unit | null;
}

export type StatusOrBuffStat = StatId | BuffStat;
