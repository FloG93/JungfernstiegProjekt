// Zod-Schemas aller Inhaltsdateien (15.5). Feldnamen exakt wie in 15-datenmodell.md.
import { z } from 'zod';
import {
  ARTIFACT_SLOTS, BOSS_IDS, CLASS_IDS, ELEMENT_IDS, ENEMY_IDS, GEM_IDS, HANDLER_IDS, ITEM_STAT_IDS,
  RARITY_IDS, SKILL_SLOTS, SLOT_IDS, STAT_IDS, STATUS_IDS,
} from './ids';
import type { HandlerId, StatusId } from './ids';

export const ClassIdSchema = z.enum(CLASS_IDS);
export const ElementIdSchema = z.enum(ELEMENT_IDS);
export const StatIdSchema = z.enum(STAT_IDS);
export const SlotIdSchema = z.enum(SLOT_IDS);
export const RarityIdSchema = z.enum(RARITY_IDS);
export const EnemyIdSchema = z.enum(ENEMY_IDS);
export const BossIdSchema = z.enum(BOSS_IDS);
export const GemIdSchema = z.enum(GEM_IDS);
export const StatusIdSchema = z.enum(STATUS_IDS);
export const HandlerIdSchema = z.enum(HANDLER_IDS);

const num = z.number().finite();
const pos = num.positive();
const nonneg = num.nonnegative();
const int = z.number().int();
const params = z.record(z.string(), z.union([num, z.string(), z.boolean()]));
const numParams = z.record(z.string(), num);

// ---------- Auto-Cast-Regeln ----------
export type AutoCastRule =
  | { when: 'enemyInRange' }
  | { when: 'inCombat' }
  | { when: 'bossPresent' }
  | { when: 'allyHasDebuff' }
  | { when: 'allyDead' }
  | { when: 'enemiesNear'; count: number; radiusPx: number }
  | { when: 'allyBelowPct'; pct: number }
  | { when: 'alliesBelowPct'; pct: number; count: number }
  | { when: 'selfBelowPct'; pct: number }
  | { when: 'any'; rules: AutoCastRule[] };

export const AutoCastRuleSchema: z.ZodType<AutoCastRule> = z.lazy(() =>
  z.discriminatedUnion('when', [
    z.strictObject({ when: z.literal('enemyInRange') }),
    z.strictObject({ when: z.literal('inCombat') }),
    z.strictObject({ when: z.literal('bossPresent') }),
    z.strictObject({ when: z.literal('allyHasDebuff') }),
    z.strictObject({ when: z.literal('allyDead') }),
    z.strictObject({ when: z.literal('enemiesNear'), count: int.positive(), radiusPx: pos }),
    z.strictObject({ when: z.literal('allyBelowPct'), pct: pos }),
    z.strictObject({ when: z.literal('alliesBelowPct'), pct: pos, count: int.positive() }),
    z.strictObject({ when: z.literal('selfBelowPct'), pct: pos }),
    z.strictObject({ when: z.literal('any'), rules: z.array(AutoCastRuleSchema).min(1) }),
  ]),
);

// ---------- Effekte ----------
export const EFFECT_TO = ['target', 'self', 'allies', 'lowestAllies', 'enemiesAroundSelf', 'enemiesAroundTarget'] as const;
export type EffectTo = (typeof EFFECT_TO)[number];
export const BUFF_STATS = [...STAT_IDS, 'dmgDealt', 'dmgTaken', 'rangePx', 'moveSpeed'] as const;
export type BuffStat = (typeof BUFF_STATS)[number];

interface EffectBase { to?: EffectTo; count?: number; radiusPx?: number }
export type DamageEffect = EffectBase & { k: 'damage'; coef: number; splashPct?: number };
export type HealEffect = EffectBase & { k: 'heal'; coef?: number; pctMaxHp?: number };
export type ShieldEffect = EffectBase & { k: 'shield'; pctMaxHpOf: 'self' | 'caster'; pct: number; ms: number };
export type StatusEffect = EffectBase & {
  k: 'status'; id: StatusId; ms: number; stacks?: number; chance?: number; value?: number; bossReplace?: Effect;
};
export type BuffEffect = EffectBase & {
  k: 'buff'; stat: BuffStat; mult?: number; add?: number; ms: number; display?: StatusId;
};
export type HandlerEffect = EffectBase & { k: 'handler'; id: HandlerId; params: Record<string, number | string | boolean> };
export type Effect = DamageEffect | HealEffect | ShieldEffect | StatusEffect | BuffEffect | HandlerEffect;

const effectBase = {
  to: z.enum(EFFECT_TO).optional(),
  count: int.positive().optional(),
  radiusPx: pos.optional(),
};

export const EffectSchema: z.ZodType<Effect> = z.lazy(() =>
  z.discriminatedUnion('k', [
    z.strictObject({ ...effectBase, k: z.literal('damage'), coef: pos, splashPct: pos.optional() }),
    z.strictObject({ ...effectBase, k: z.literal('heal'), coef: pos.optional(), pctMaxHp: pos.optional() })
      .refine((e) => (e.coef === undefined) !== (e.pctMaxHp === undefined), 'heal braucht genau coef oder pctMaxHp'),
    z.strictObject({
      ...effectBase, k: z.literal('shield'), pctMaxHpOf: z.enum(['self', 'caster']), pct: pos, ms: pos,
    }),
    z.strictObject({
      ...effectBase, k: z.literal('status'), id: StatusIdSchema, ms: pos, stacks: int.positive().optional(),
      chance: pos.max(1).optional(), value: pos.optional(), bossReplace: EffectSchema.optional(),
    }),
    z.strictObject({
      ...effectBase, k: z.literal('buff'), stat: z.enum(BUFF_STATS), mult: pos.optional(), add: num.optional(),
      ms: nonneg, display: StatusIdSchema.optional(),
    }).refine((e) => (e.mult === undefined) !== (e.add === undefined), 'buff braucht genau mult oder add'),
    z.strictObject({ ...effectBase, k: z.literal('handler'), id: HandlerIdSchema, params }),
  ]),
);

// ---------- Klassen und Fähigkeiten ----------
const shares = z.strictObject(Object.fromEntries(ITEM_STAT_IDS.map((s) => [s, nonneg])) as Record<
  (typeof ITEM_STAT_IDS)[number], typeof nonneg
>);

export const ClassDefSchema = z.strictObject({
  id: ClassIdSchema,
  name: z.string().min(1),
  role: z.string().min(1),
  weapon: z.string().min(1),
  offhand: z.string().min(1),
  material: z.string().min(1),
  rangePx: pos,
  hpFactor: pos,
  threat: pos,
  solo: pos,
  formationOffsetPx: num,
  shares,
  skills: z.array(z.string()).length(SKILL_SLOTS.length),
});
export type ClassDef = z.infer<typeof ClassDefSchema>;

export const SkillDefSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+_[a-z_]+$/),
  class: ClassIdSchema,
  slot: z.enum(SKILL_SLOTS),
  unlockLevel: int.positive(),
  cooldownS: nonneg,
  target: z.enum(['nearest', 'focus', 'lowestAlly', 'self', 'ground', 'none']),
  rangePx: pos.optional(),
  autoCast: z.strictObject({ default: z.boolean(), rule: AutoCastRuleSchema }).optional(),
  effects: z.array(EffectSchema).min(1),
});
export type SkillDef = z.infer<typeof SkillDefSchema>;

// ---------- Status und Elemente ----------
export const StatusDefSchema = z.strictObject({
  id: StatusIdSchema,
  kind: z.enum(['buff', 'debuff']),
  maxStacks: int.positive(),
  defaultMs: pos,
  tickMs: pos.optional(),
  weakening: z.boolean(),
  cleanseOrder: int.positive().optional(),
  bossImmune: z.boolean(),
  eliteDurationMult: pos,
  params: numParams,
});
export type StatusDef = z.infer<typeof StatusDefSchema>;

export const ElementDefSchema = z.strictObject({
  id: ElementIdSchema,
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string().min(1),
  weakTo: ElementIdSchema.nullable(),
});
export type ElementDef = z.infer<typeof ElementDefSchema>;

// ---------- Gegner ----------
export const EnemyDefSchema = z.strictObject({
  id: EnemyIdSchema,
  hpMult: pos,
  dmgMult: pos,
  armorMit: nonneg.max(1),
  resMit: nonneg.max(1),
  speed: pos,
  rangePx: pos,
  intervalS: pos,
  element: z.enum(['physisch', 'kapitel']),
  weight: pos,
  groupSize: int.positive(),
  ai: z.enum(['melee', 'ranged', 'support', 'bomber', 'guardian']),
  handlers: z.array(z.strictObject({ id: HandlerIdSchema, params: z.record(z.string(), z.union([num, z.string()])) })),
});
export type EnemyDef = z.infer<typeof EnemyDefSchema>;

export const EliteDefSchema = z.strictObject({
  hpMult: pos,
  dmgMult: pos,
  armorMit: nonneg.max(1),
  resMit: nonneg.max(1),
  weight: pos,
  replacesPoints: pos,
  bases: z.array(EnemyIdSchema).min(1),
  basesFromChapter: z.partialRecord(EnemyIdSchema, int.positive()),
  affixes: z.array(HandlerIdSchema).min(1),
  affixParams: z.record(z.string(), numParams),
  slam: z.strictObject({ everyS: pos, telegraphMs: pos, radiusPx: pos, pctRefHp: pos }),
  itemChance: nonneg.max(1),
});
export type EliteDef = z.infer<typeof EliteDefSchema>;

export const EnemiesFileSchema = z.strictObject({ enemies: z.array(EnemyDefSchema), elite: EliteDefSchema });

// ---------- Bosse, Arenen, Stages ----------
export const AttackSchema = z.strictObject({
  intervalMs: pos,
  pctRefHp: pos,
  dmgType: z.enum(['phys', 'elem']),
  shape: z.enum(['single', 'all', 'circle', 'handler']),
  radiusPx: pos.optional(),
  telegraphMs: pos.optional(),
  fromPhase: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  handler: HandlerIdSchema.optional(),
  params: z.record(z.string(), z.union([num, z.string()])).optional(),
});
export type Attack = z.infer<typeof AttackSchema>;

export const BossDefSchema = z.strictObject({
  id: BossIdSchema,
  chapter: int.min(1).max(6),
  name: z.string().min(1),
  hpBase: pos,
  element: ElementIdSchema,
  armorMit: nonneg.max(1),
  resMit: nonneg.max(1),
  timerMinutes: pos,
  phases: z.array(z.strictObject({ fromPct: nonneg, toPct: nonneg, element: ElementIdSchema })).length(3),
  attacks: z.strictObject({ standard: AttackSchema, pulse: AttackSchema, telegraph: AttackSchema, signature: AttackSchema }),
  passive: z.strictObject({ id: HandlerIdSchema, params: z.record(z.string(), z.union([num, z.string()])) }),
  debuff: StatusIdSchema,
  weapon: z.strictObject({ status: StatusIdSchema, stacks: int.positive(), chance: pos.max(1) }),
  adds: z.strictObject({ enemy: z.literal('schwarmling'), firstAtS: pos, everyS: pos, groupsPerWave: int.positive() }),
  arena: z.string().regex(/^arena_[a-z]+$/),
  dialog: z.strictObject({ before: z.string(), after: z.string() }),
});
export type BossDef = z.infer<typeof BossDefSchema>;

export const ArenaDefSchema = z.strictObject({
  id: z.string().regex(/^arena_[a-z]+$/),
  widthPx: pos,
  depthPx: pos,
  heroStartX: z.tuple([num, num]),
  bossStartX: num,
  background: z.string().min(1),
});
export type ArenaDef = z.infer<typeof ArenaDefSchema>;

export const StageDefSchema = z.strictObject({
  stage: int.min(1).max(30),
  chapter: int.min(1).max(6),
  recommendedLevel: int.positive(),
  lengthPx: pos,
  encounters: z.array(z.strictObject({
    x: pos,
    points: pos,
    groupSplit: z.array(pos).min(1),
    groupDelaysS: z.array(nonneg).min(1),
    elites: int.nonnegative(),
    hazard: z.boolean(),
  })).min(1),
  checkpoints: z.array(pos),
  hazard: HandlerIdSchema.nullable(),
  boss: BossIdSchema.optional(),
  introId: z.string().regex(/^stage-\d{2}$/),
  loot: z.enum(['normal', 'boss']),
});
export type StageDef = z.infer<typeof StageDefSchema>;

export const PaletteFileSchema = z.record(z.string().regex(/^[1-6]$/), z.partialRecord(EnemyIdSchema, nonneg));
export type PaletteFile = z.infer<typeof PaletteFileSchema>;

// ---------- Beute, Gems, Artefakte ----------
const slotWeights = z.record(SlotIdSchema, nonneg);
export const StageLootFileSchema = z.strictObject({
  itemsPerChest: int.positive(),
  eliteItemChance: nonneg.max(1),
  gemChance: nonneg.max(1),
  splinters: int.nonnegative(),
  slotWeights,
  rarityByChapter: z.record(z.string().regex(/^[1-6]$/), z.partialRecord(RarityIdSchema, nonneg)),
  weaponElement: z.record(ElementIdSchema, nonneg),
});
export type StageLootFile = z.infer<typeof StageLootFileSchema>;

const bossDropRow = z.strictObject({
  weapon: nonneg.max(100),
  item: z.partialRecord(RarityIdSchema, nonneg),
  gem: nonneg.max(100),
  splinters: int.nonnegative(),
  goldFactor: nonneg,
  xpFactor: nonneg,
});
export const BossDropsFileSchema = z.strictObject({
  first: bossDropRow,
  repeat: bossDropRow,
  itemSlotWeights: slotWeights,
  elementCoreChance: nonneg,
});
export type BossDropsFile = z.infer<typeof BossDropsFileSchema>;

export const GemFileSchema = z.strictObject({
  kinds: z.array(z.strictObject({ id: GemIdSchema, stat: StatIdSchema })).length(GEM_IDS.length),
  tierPoints: z.array(pos).min(1),
  tierNames: z.array(z.string().min(1)).min(1),
  combineCostMult: pos,
  swapCostMult: pos,
  slotUnlockLevels: z.array(int.positive()).min(1),
  chestTierByChapter: z.record(z.string().regex(/^[1-6]$/), z.array(nonneg)),
  bossTierOffset: int.nonnegative(),
});
export type GemFile = z.infer<typeof GemFileSchema>;

export const ArtifactDefSchema = z.strictObject({
  id: z.string().regex(/^[a-z]+_(amulett|ring|relikt)$/),
  class: ClassIdSchema,
  slot: z.enum(ARTIFACT_SLOTS),
  name: z.string().min(1),
  unlockBoss: BossIdSchema,
  rankPoints: z.array(pos).min(1),
  rankCost: z.array(int.nonnegative()).min(1),
  effect: EffectSchema,
});
export type ArtifactDef = z.infer<typeof ArtifactDefSchema>;

// ---------- Texte ----------
const line = z.strictObject({ speaker: z.string().min(1), text: z.string().min(1) });
export const StoryFileSchema = z.strictObject({
  chapter: int.min(1).max(6),
  stageIntros: z.record(z.string().regex(/^stage-\d{2}$/), z.string().min(1)),
  dialogs: z.record(z.string(), z.array(line).min(1)),
  epilogue: z.array(line).optional(),
});
export type StoryFile = z.infer<typeof StoryFileSchema>;
export type StoryLine = z.infer<typeof line>;

export const NamesFileSchema = z.strictObject({
  prefixes: z.record(RarityIdSchema, z.array(z.string().min(1)).min(1)),
  suffixes: z.array(z.string().min(1)).min(1),
  types: z.record(ClassIdSchema, z.record(SlotIdSchema, z.string().min(1))),
  bossGenitive: z.record(BossIdSchema, z.string().min(1)),
});
export type NamesFile = z.infer<typeof NamesFileSchema>;

export const I18nFileSchema = z.record(z.string(), z.record(z.string(), z.string().min(1)));
export type I18nFile = z.infer<typeof I18nFileSchema>;

// ---------- balance.json (Startwerte 15.5) ----------
const pair = z.tuple([num, num]);
export const BalanceSchema = z.strictObject({
  stats: z.strictObject({
    perPoint: z.strictObject({ leb: pos, kra: pos, rue: pos, res: pos, tmp: pos, krt: pos, ksd: pos }),
    base: z.strictObject({ leb: pair, kra: pair, rue: pair, res: pair, tmp: nonneg, krt: nonneg, ksd: pos }),
    caps: z.strictObject({ tmp: pos, krt: pos, krtBuffed: pos, ksd: pos, ele: pos }),
    maxLevel: int.positive(),
    levelUpHealPct: nonneg,
  }),
  items: z.strictObject({
    slotWeights: z.record(SlotIdSchema, pos),
    rarity: z.record(RarityIdSchema, pos),
    budget: z.strictObject({ base: pos, perIlvl: pos }),
    rollJitter: pair,
    maxIlvl: int.positive(),
    reqOffset: int.nonnegative(),
    legendaryElePct: nonneg,
    sellDivisor: pos,
    inventory: int.positive(),
    stash: int.positive(),
  }),
  weapon: z.strictObject({
    xp: z.strictObject({ mult: pos, exp: pos, round: pos, share: pos, shareAtMaxLevel: pos }),
    bonusPerLevel: pos,
    maxLevel: int.positive(),
    swapMs: pos,
    swapLockS: pos,
    transferGoldPerLevel: pos,
    elementChangeGoldPerIlvl: pos,
    enchant: z.strictObject({ lines: int.positive(), maxRank: int.positive(), goldPerRankSq: pos, changeTypeGold: pos }),
  }),
  combat: z.strictObject({
    tickRate: int.positive(),
    mitigation: z.strictObject({ base: pos, perLevel: pos }),
    roll: z.strictObject({ px: pos, invulnMs: pos, cooldownS: pos }),
    revive: z.strictObject({ channelS: pos, pct: pos }),
    potion: z.strictObject({ charges: int.positive(), pct: pos, cooldownS: pos }),
    maxEffects: int.positive(),
    threatSwitch: pos,
    healThreat: nonneg,
    meleeSlots: int.positive(),
    telegraphMs: pos,
  }),
  movement: z.strictObject({
    manual: pos, autowalk: pos, leashPx: pos, formationReturnS: pos, sameClassDepthPx: pos,
  }),
  enemy: z.strictObject({
    life: z.strictObject({ base: pos, perLevel: pos }),
    damage: z.strictObject({ base: pos, perLevel: pos }),
  }),
  stage: z.strictObject({
    lengthPx: pos,
    encounterX: z.array(pos),
    encounterPoints: z.array(pos),
    groupSplit: z.array(z.array(pos)),
    groupDelaysS: z.array(nonneg),
    minGroupSize: int.positive(),
    restDropBelow: nonneg,
    spawnRightShare: nonneg.max(1),
    maxAlive: int.positive(),
    resumeBelow: int.positive(),
    rushAfterS: pos,
    rushSpeed: pos,
    checkpointX: z.array(pos),
    regenBetweenPct: nonneg,
    reviveAtEncounterEndPct: pos,
    intro: z.strictObject({ stages: z.array(int.positive()), mult: pos }),
    hazard: z.strictObject({ encounters: z.array(int.positive()), pctRefHp: pos, everyS: pos, telegraphMs: pos }),
    bossStage: z.strictObject({
      encounterX: z.array(pos), encounterPoints: z.array(pos), checkpointX: z.array(pos), lengthPx: pos,
    }),
  }),
  party: z.strictObject({
    maxSize: int.positive(),
    spawnCount: z.strictObject({ perExtra: nonneg }),
    life: z.strictObject({ perExtra: nonneg }),
    lateJoinerLevels: int.nonnegative(),
  }),
  boss: z.strictObject({
    damage: z.strictObject({ base: pos, perExtra: nonneg }),
    kampfstufeProzent: nonneg,
    kampfstufeMax: int.nonnegative(),
    levelPerChapter: int.positive(),
    refLife: z.array(pos).length(6),
    enrage: z.strictObject({ seconds: pos, bonus: nonneg, stepSeconds: pos, stepBonus: nonneg }),
    phaseTransition: z.strictObject({ invulnMs: pos, healPct: nonneg, revivePct: pos }),
    rage: z.strictObject({ everyS: pos, ms: pos }),
    moveSpeed: pos,
    meleeRangePx: pos,
    slowCapPct: pos,
    readyCountdownS: pos,
    timersMinutes: z.array(pos).length(6),
  }),
  progression: z.strictObject({
    xpCurve: z.strictObject({ mult: pos, exp: pos, round: pos }),
    xpFactors: z.strictObject({
      bossStageEncounters: nonneg, bossFirst: nonneg, bossRepeat: nonneg, stageRepeat: nonneg, helper: nonneg,
    }),
  }),
  gold: z.strictObject({
    stage: z.strictObject({ perPoint: pos, base: pos, perStage: pos }),
    bossStagePoints: pos,
    bossFirst: nonneg,
    bossRepeat: nonneg,
    stageRepeat: nonneg,
  }),
  artifacts: z.strictObject({
    splinters: z.strictObject({ stage: int.nonnegative(), bossFirst: int.nonnegative(), bossRepeat: int.nonnegative() }),
  }),
  session: z.strictObject({ soloPauseMaxS: pos, inviteTtlS: pos, awayAfterS: pos, chatMaxLen: int.positive() }),
  net: z.strictObject({
    snapshotEveryTicks: int.positive(),
    fullSnapshotS: pos,
    maxInputsPerS: int.positive(),
    maxMsgsPerS: int.positive(),
    disconnectGraceS: pos,
    emptyRunTimeoutS: pos,
    maxRuns: int.positive(),
    maxSnapshotBytes: int.positive(),
  }),
});
export type Balance = z.infer<typeof BalanceSchema>;

// ---------- Ergänzungen (OPEN-006 bis OPEN-008) ----------
// Zahlen aus dem Fließtext der Spezifikation, die in den mitgelieferten Dateien fehlen.

const statusApply = z.strictObject({
  id: StatusIdSchema, ms: pos, stacks: int.positive().optional(), value: pos.optional(),
});
export const HazardDefSchema = z.strictObject({
  id: HandlerIdSchema,
  chapter: int.min(1).max(6),
  shape: z.enum(['circle', 'line']),
  radiusPx: pos.optional(),
  widthPx: pos.optional(),
  lengthPx: pos.optional(),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  hitStatus: statusApply.optional(),
  linger: z.strictObject({ ms: pos, tickMs: pos, status: statusApply }).optional(),
});
export type HazardDef = z.infer<typeof HazardDefSchema>;

export const EnchantDefSchema = z.strictObject({
  id: z.enum(['waffenschaden', 'kraft', 'kritschaden', 'tempo', 'vitalitaet', 'panzerung']),
  name: z.string().min(1),
  stats: z.array(StatIdSchema).min(1),
  mode: z.enum(['add', 'pct']),
  perRank: pos,
});
export type EnchantDef = z.infer<typeof EnchantDefSchema>;
export type EnchantId = EnchantDef['id'];

export const GendersFileSchema = z.record(z.string(), z.enum(['m', 'f', 'n', 'pl']));
export type GendersFile = z.infer<typeof GendersFileSchema>;

export const EngineFileSchema = z.strictObject({
  world: z.strictObject({
    bandDepthPx: pos,
    viewWidthPx: pos,
    spawnEdgeOffsetPx: nonneg,
    separationRadiusPx: pos,
    separationPushPxPerS: pos,
    hazardSpreadPx: pos,
  }),
  hero: z.strictObject({
    chaseRangeFraction: pos.max(1),
    reviveRadiusPx: pos,
  }),
  enemy: z.strictObject({
    cultistOrbRadiusPx: pos,
    meleeOrbitPx: pos,
    projectileSpeedPxPerS: pos,
    bomberDeathFuse: z.boolean(),
  }),
  boss: z.strictObject({
    rangedThrowSpeedPxPerS: pos,
    beamRotationDeg: num,
    addSpawnInsetPx: nonneg,
  }),
  idle: z.strictObject({ autoPotionBelowPct: pos, autoContinueDelayS: pos }),
  appearance: z.strictObject({ bodies: int.positive(), portraits: int.positive(), palettes: int.positive() }),
  limits: z.strictObject({
    heroNameMin: int.positive(),
    heroNameMax: int.positive(),
    usernameMin: int.positive(),
    usernameMax: int.positive(),
    passwordMin: int.positive(),
    sessionDays: pos,
  }),
  party: z.strictObject({
    codeLength: int.positive(),
    codeAlphabet: z.string().min(2),
    startCountdownS: pos,
    pingMs: pos,
    quickMessages: int.positive(),
  }),
});
export type EngineFile = z.infer<typeof EngineFileSchema>;
