// Content-Loader (2.3, 15.5): validiert alle Inhaltsdateien und prüft Querverweise.
// Fehler brechen den Start ab (ContentError mit allen gefundenen Problemen).
import type { z } from 'zod';
import {
  ARTIFACT_SLOTS, BOSS_IDS, CLASS_IDS, ELEMENT_IDS, ENEMY_IDS, GEM_IDS, SKILL_SLOTS, SLOT_IDS, STATUS_IDS,
} from './ids';
import type { BossId, ClassId, ElementId, EnemyId, GemId, HandlerId, StatusId } from './ids';
import {
  ArenaDefSchema, ArtifactDefSchema, BalanceSchema, BossDefSchema, BossDropsFileSchema, ClassDefSchema,
  ElementDefSchema, EnchantDefSchema, EnemiesFileSchema, EngineFileSchema, GemFileSchema, GendersFileSchema,
  HazardDefSchema, I18nFileSchema, NamesFileSchema, PaletteFileSchema, SkillDefSchema, StageDefSchema,
  StageLootFileSchema, StatusDefSchema, StoryFileSchema,
} from './schemas';
import type {
  ArenaDef, ArtifactDef, Balance, BossDef, BossDropsFile, ClassDef, ElementDef, EliteDef, EnchantDef, EnemyDef,
  EngineFile, GemFile, GendersFile, HazardDef, I18nFile, NamesFile, PaletteFile, SkillDef, StageDef, StageLootFile,
  StatusDef, StoryFile, StoryLine,
} from './schemas';

export const STAGE_COUNT = 30;
export const CHAPTER_COUNT = 6;
export const STAGES_PER_CHAPTER = 5;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Alle Dateien relativ zu packages/content, die der Loader erwartet. */
export const CONTENT_FILES = {
  balance: 'balance.json',
  classes: 'classes.json',
  skills: 'skills.json',
  status: 'status.json',
  elements: 'elements.json',
  enemies: 'enemies.json',
  arenas: 'arenas.json',
  bosses: 'bosses.json',
  palette: 'levels/palette.json',
  hazards: 'levels/hazards.json',
  names: 'items/names.json',
  genders: 'items/genders.json',
  stageLoot: 'loot/stage-loot.json',
  bossDrops: 'loot/boss-drops.json',
  gems: 'gems.json',
  artifacts: 'artifacts.json',
  enchants: 'enchants.json',
  engine: 'engine.json',
  i18n: 'i18n/de.json',
} as const;

export const stageFile = (stage: number) => `levels/stage-${pad2(stage)}.json`;
export const storyFile = (chapter: number) => `story/kapitel${chapter}.json`;

export function contentFileList(): string[] {
  const files: string[] = Object.values(CONTENT_FILES);
  for (let s = 1; s <= STAGE_COUNT; s++) files.push(stageFile(s));
  for (let c = 1; c <= CHAPTER_COUNT; c++) files.push(storyFile(c));
  return files;
}

export type RawContent = Record<string, unknown>;

export class ContentError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Inhaltsdateien fehlerhaft (${problems.length}):\n- ${problems.join('\n- ')}`);
    this.name = 'ContentError';
  }
}

export interface Content {
  balance: Balance;
  engine: EngineFile;
  classes: ClassDef[];
  classById: Record<ClassId, ClassDef>;
  skills: SkillDef[];
  skillById: ReadonlyMap<string, SkillDef>;
  statuses: StatusDef[];
  statusById: Record<StatusId, StatusDef>;
  elements: ElementDef[];
  elementById: Record<ElementId, ElementDef>;
  enemies: EnemyDef[];
  enemyById: Record<EnemyId, EnemyDef>;
  elite: EliteDef;
  arenas: ArenaDef[];
  arenaById: ReadonlyMap<string, ArenaDef>;
  bosses: BossDef[];
  bossById: Record<BossId, BossDef>;
  palette: PaletteFile;
  hazards: HazardDef[];
  hazardById: ReadonlyMap<HandlerId, HazardDef>;
  /** Index 0 entspricht Stage 1. */
  stages: StageDef[];
  names: NamesFile;
  genders: GendersFile;
  stageLoot: StageLootFile;
  bossDrops: BossDropsFile;
  gems: GemFile;
  gemStat: Record<GemId, string>;
  artifacts: ArtifactDef[];
  artifactById: ReadonlyMap<string, ArtifactDef>;
  enchants: EnchantDef[];
  /** Index 0 entspricht Kapitel 1. */
  story: StoryFile[];
  i18n: I18nFile;
}

const EPS = 1e-6;
const PERCENT = 100;

/** Pfade unter balance., die ein Artefakt ändern darf (E-016, 15.5). */
export const ARTIFACT_BALANCE_PATHS = [
  'combat.potion.pct', 'combat.potion.cooldownS', 'combat.roll.px', 'combat.roll.cooldownS', 'combat.revive.channelS',
] as const;

function sum(values: Iterable<number>): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

function indexBy<T, K extends string>(items: T[], key: (t: T) => K): Record<K, T> {
  const out = {} as Record<K, T>;
  for (const it of items) out[key(it)] = it;
  return out;
}

export function loadContent(raw: RawContent): Content {
  const problems: string[] = [];

  function parse<S extends z.ZodType>(file: string, schema: S): z.infer<S> | undefined {
    if (!(file in raw)) {
      problems.push(`${file}: Datei fehlt`);
      return undefined;
    }
    const r = schema.safeParse(raw[file]);
    if (!r.success) {
      for (const issue of r.error.issues.slice(0, 20)) {
        problems.push(`${file}: ${issue.path.join('.') || '(Wurzel)'}: ${issue.message}`);
      }
      return undefined;
    }
    return r.data;
  }
  const arr = <S extends z.ZodType>(file: string, schema: S) => parse(file, schemaArray(schema)) as z.infer<S>[] | undefined;

  const balance = parse(CONTENT_FILES.balance, BalanceSchema);
  const engine = parse(CONTENT_FILES.engine, EngineFileSchema);
  const classes = arr(CONTENT_FILES.classes, ClassDefSchema);
  const skills = arr(CONTENT_FILES.skills, SkillDefSchema);
  const statuses = arr(CONTENT_FILES.status, StatusDefSchema);
  const elements = arr(CONTENT_FILES.elements, ElementDefSchema);
  const enemiesFile = parse(CONTENT_FILES.enemies, EnemiesFileSchema);
  const arenas = arr(CONTENT_FILES.arenas, ArenaDefSchema);
  const bosses = arr(CONTENT_FILES.bosses, BossDefSchema);
  const palette = parse(CONTENT_FILES.palette, PaletteFileSchema);
  const hazards = arr(CONTENT_FILES.hazards, HazardDefSchema);
  const names = parse(CONTENT_FILES.names, NamesFileSchema);
  const genders = parse(CONTENT_FILES.genders, GendersFileSchema);
  const stageLoot = parse(CONTENT_FILES.stageLoot, StageLootFileSchema);
  const bossDrops = parse(CONTENT_FILES.bossDrops, BossDropsFileSchema);
  const gems = parse(CONTENT_FILES.gems, GemFileSchema);
  const artifacts = arr(CONTENT_FILES.artifacts, ArtifactDefSchema);
  const enchants = arr(CONTENT_FILES.enchants, EnchantDefSchema);
  const i18n = parse(CONTENT_FILES.i18n, I18nFileSchema);
  const stages: StageDef[] = [];
  for (let s = 1; s <= STAGE_COUNT; s++) {
    const st = parse(stageFile(s), StageDefSchema);
    if (st) stages.push(st);
  }
  const story: StoryFile[] = [];
  for (let c = 1; c <= CHAPTER_COUNT; c++) {
    const sf = parse(storyFile(c), StoryFileSchema);
    if (sf) story.push(sf);
  }

  if (
    problems.length > 0 || !balance || !engine || !classes || !skills || !statuses || !elements || !enemiesFile ||
    !arenas || !bosses || !palette || !hazards || !names || !genders || !stageLoot || !bossDrops || !gems ||
    !artifacts || !enchants || !i18n
  ) {
    throw new ContentError(problems);
  }

  const check = (ok: boolean, msg: string) => {
    if (!ok) problems.push(msg);
  };
  const exactlyOnce = <T extends string>(file: string, ids: readonly T[], present: string[]) => {
    for (const id of ids) {
      const n = present.filter((p) => p === id).length;
      check(n === 1, `${file}: ${id} kommt ${n}-mal vor (erwartet genau einmal)`);
    }
    for (const p of present) check((ids as readonly string[]).includes(p), `${file}: unbekannte ID ${p}`);
  };

  // Klassen und Fähigkeiten (4, 5.4)
  exactlyOnce(CONTENT_FILES.classes, CLASS_IDS, classes.map((c) => c.id));
  const skillById = new Map<string, SkillDef>();
  for (const sk of skills) {
    check(!skillById.has(sk.id), `skills.json: ${sk.id} doppelt`);
    skillById.set(sk.id, sk);
    check(sk.id.startsWith(`${sk.class}_`), `skills.json: ${sk.id} beginnt nicht mit der Klasse ${sk.class}`);
    if (sk.slot === 'passive') {
      check(sk.autoCast === undefined && sk.cooldownS === 0, `skills.json: Passiv ${sk.id} ohne Auto-Cast und Abklingzeit`);
    } else {
      check(sk.autoCast !== undefined && sk.cooldownS > 0, `skills.json: ${sk.id} braucht Auto-Cast und Abklingzeit`);
    }
  }
  for (const c of classes) {
    check(Math.abs(sum(Object.values(c.shares)) - 1) < EPS, `classes.json: Anteile von ${c.id} ergeben nicht 1`);
    c.skills.forEach((id, i) => {
      const sk = skillById.get(id);
      check(!!sk, `classes.json: ${c.id} verweist auf unbekannte Fähigkeit ${id}`);
      if (sk) {
        check(sk.class === c.id, `classes.json: ${id} gehört nicht zu ${c.id}`);
        check(sk.slot === SKILL_SLOTS[i], `classes.json: ${id} steht nicht an Platz ${SKILL_SLOTS[i]}`);
      }
    });
  }
  check(skills.length === CLASS_IDS.length * SKILL_SLOTS.length, `skills.json: ${skills.length} statt 36 Fähigkeiten`);

  // Status und Elemente (6.1, 6.3)
  exactlyOnce(CONTENT_FILES.status, STATUS_IDS, statuses.map((s) => s.id));
  exactlyOnce(CONTENT_FILES.elements, ELEMENT_IDS, elements.map((e) => e.id));
  const elementById = indexBy(elements, (e) => e.id);
  for (const e of elements) {
    if (e.weakTo) check(elementById[e.weakTo]?.weakTo === e.id, `elements.json: Gegenelement von ${e.id} nicht paarweise`);
    else check(e.id === 'physisch', `elements.json: ${e.id} ohne Gegenelement`);
  }

  // Gegner (9.3, 9.7)
  const enemies = enemiesFile.enemies;
  const elite = enemiesFile.elite;
  exactlyOnce(CONTENT_FILES.enemies, ENEMY_IDS, enemies.map((e) => e.id));
  const enemyById = indexBy(enemies, (e) => e.id);
  for (const b of Object.keys(elite.basesFromChapter)) {
    check((elite.bases as string[]).includes(b), `enemies.json: elite.basesFromChapter nennt ${b}, das nicht in bases steht`);
  }
  for (const a of elite.affixes) check(a in elite.affixParams, `enemies.json: Affix ${a} ohne Parameter`);

  // Paletten (9.5)
  for (let c = 1; c <= CHAPTER_COUNT; c++) {
    const p = palette[String(c)];
    check(!!p, `palette.json: Kapitel ${c} fehlt`);
    if (p) check(Math.abs(sum(Object.values(p)) - PERCENT) < EPS, `palette.json: Kapitel ${c} ergibt nicht 100`);
  }

  // Arenen und Bosse (10)
  const arenaById = new Map(arenas.map((a) => [a.id, a]));
  exactlyOnce(CONTENT_FILES.bosses, BOSS_IDS, bosses.map((b) => b.id));
  const bossById = indexBy(bosses, (b) => b.id);
  const storyByChapter = new Map(story.map((s) => [s.chapter, s]));
  for (const b of bosses) {
    check(arenaById.has(b.arena), `bosses.json: ${b.id} verweist auf unbekannte Arena ${b.arena}`);
    const sf = storyByChapter.get(b.chapter);
    check(!!sf?.dialogs[b.dialog.before] && !!sf?.dialogs[b.dialog.after], `bosses.json: Dialoge von ${b.id} fehlen`);
    const sig = b.attacks.signature;
    check(sig.shape === 'handler' && !!sig.handler, `bosses.json: Signaturangriff von ${b.id} braucht einen Handler`);
  }

  // Gefahren (9.8)
  const hazardById = new Map(hazards.map((h) => [h.id, h]));
  for (const h of hazards) {
    check(h.id.startsWith('hazard_'), `hazards.json: ${h.id} ist kein Gefahren-Handler`);
    if (h.shape === 'circle') check(h.radiusPx !== undefined, `hazards.json: ${h.id} braucht radiusPx`);
    else check(h.widthPx !== undefined && h.lengthPx !== undefined, `hazards.json: ${h.id} braucht widthPx und lengthPx`);
  }

  // Stages (9)
  check(stages.length === STAGE_COUNT, `levels: ${stages.length} statt ${STAGE_COUNT} Stages`);
  stages.forEach((st, i) => {
    const s = i + 1;
    const w = stageFile(s);
    check(st.stage === s, `${w}: stage ist ${st.stage}`);
    check(st.chapter === Math.ceil(s / STAGES_PER_CHAPTER), `${w}: falsches Kapitel`);
    const isBoss = s % STAGES_PER_CHAPTER === 0;
    check(isBoss === (st.loot === 'boss') && isBoss === (st.boss !== undefined), `${w}: Boss-Stage uneinheitlich`);
    if (st.boss) check(bossById[st.boss]?.chapter === st.chapter, `${w}: Boss ${st.boss} gehört nicht zu Kapitel ${st.chapter}`);
    if (st.hazard) check(hazardById.has(st.hazard), `${w}: Gefahr ${st.hazard} hat keine Daten in hazards.json`);
    const sf = storyByChapter.get(st.chapter);
    check(!!sf?.stageIntros[st.introId], `${w}: Einleitungstext ${st.introId} fehlt`);
    for (const e of st.encounters) {
      check(Math.abs(sum(e.groupSplit) - 1) < EPS, `${w}: groupSplit ergibt nicht 1`);
      check(e.groupSplit.length === e.groupDelaysS.length, `${w}: groupSplit und groupDelaysS ungleich lang`);
      check(e.x < st.lengthPx, `${w}: Begegnung hinter dem Ziel`);
    }
  });

  // Beute (10.8, 12.8)
  check(Math.abs(sum(Object.values(stageLoot.slotWeights)) - PERCENT) < EPS, 'stage-loot.json: Slot-Anteile ergeben nicht 100');
  check(Math.abs(sum(Object.values(stageLoot.weaponElement)) - PERCENT) < EPS, 'stage-loot.json: Waffenelemente ergeben nicht 100');
  for (let c = 1; c <= CHAPTER_COUNT; c++) {
    const r = stageLoot.rarityByChapter[String(c)];
    check(!!r && Math.abs(sum(Object.values(r)) - PERCENT) < EPS, `stage-loot.json: Seltenheiten Kapitel ${c} ergeben nicht 100`);
    check(!r?.legendaer, `stage-loot.json: Kapitel ${c} enthält Legendär (nur Bosse, 8.3)`);
    const g = gems.chestTierByChapter[String(c)];
    check(!!g && g.length === gems.tierPoints.length && Math.abs(sum(g) - PERCENT) < EPS, `gems.json: Stufen Kapitel ${c} ungültig`);
  }
  for (const row of [bossDrops.first, bossDrops.repeat]) {
    check(Math.abs(sum(Object.values(row.item)) - PERCENT) < EPS, 'boss-drops.json: Seltenheiten ergeben nicht 100');
  }
  check(Math.abs(sum(Object.values(bossDrops.itemSlotWeights)) - PERCENT) < EPS, 'boss-drops.json: Slot-Anteile ergeben nicht 100');

  // Gems (7)
  exactlyOnce(CONTENT_FILES.gems, GEM_IDS, gems.kinds.map((k) => k.id));
  check(gems.tierNames.length === gems.tierPoints.length, 'gems.json: tierNames und tierPoints ungleich lang');
  const gemStat = Object.fromEntries(gems.kinds.map((k) => [k.id, k.stat])) as Record<GemId, string>;

  // Artefakte (7.6, 7.7, E-016, E-017)
  const artifactById = new Map<string, ArtifactDef>();
  for (const a of artifacts) {
    check(!artifactById.has(a.id), `artifacts.json: ${a.id} doppelt`);
    artifactById.set(a.id, a);
    check(a.id === `${a.class}_${a.slot}`, `artifacts.json: ID ${a.id} passt nicht zu Klasse und Slot`);
    check(a.rankPoints.length === a.rankCost.length, `artifacts.json: ${a.id} Ränge und Kosten ungleich lang`);
    const problem = checkModifyPath(a, skillById);
    if (problem) problems.push(`artifacts.json: ${a.id}: ${problem}`);
  }
  for (const c of CLASS_IDS) {
    for (const slot of ARTIFACT_SLOTS) check(artifactById.has(`${c}_${slot}`), `artifacts.json: ${c}_${slot} fehlt`);
  }

  // Verzauberungen und Namen (8.3, 8.7)
  check(enchants.length === new Set(enchants.map((e) => e.id)).size, 'enchants.json: doppelte IDs');
  for (const c of CLASS_IDS) {
    for (const slot of SLOT_IDS) {
      const t = names.types[c][slot];
      check(t in genders, `genders.json: Geschlecht von „${t}“ fehlt`);
    }
  }

  // Texte (3.2)
  check(story.length === CHAPTER_COUNT, `story: ${story.length} statt ${CHAPTER_COUNT} Kapitel`);
  story.forEach((sf, i) => check(sf.chapter === i + 1, `${storyFile(i + 1)}: Kapitel ist ${sf.chapter}`));

  if (problems.length > 0) throw new ContentError(problems);

  return {
    balance, engine, classes, classById: indexBy(classes, (c) => c.id), skills, skillById, statuses,
    statusById: indexBy(statuses, (s) => s.id), elements, elementById, enemies, enemyById, elite, arenas,
    arenaById, bosses, bossById, palette, hazards, hazardById, stages, names, genders, stageLoot, bossDrops,
    gems, gemStat, artifacts, artifactById, enchants, story, i18n,
  };
}

function schemaArray<S extends z.ZodType>(schema: S) {
  // z.array ohne direkten Import von z als Wert (verbatimModuleSyntax): über die Methode des Schemas.
  return schema.array();
}

/** Prüft den Pfad eines modifyValue-Effekts (15.5, E-015 bis E-017). Gibt einen Fehlertext oder null zurück. */
export function checkModifyPath(a: ArtifactDef, skillById: ReadonlyMap<string, SkillDef>): string | null {
  const eff = a.effect;
  if (eff.k !== 'handler' || eff.id !== 'modifyValue') return 'Effekt ist kein modifyValue';
  const path = eff.params['path'];
  if (typeof path !== 'string') return 'path fehlt';
  const ops = ['add', 'mult', 'set'].filter((k) => typeof eff.params[k] === 'number');
  if (ops.length !== 1) return 'genau eines von add, mult, set erwartet';
  if (path === 'self.buffDurationMs') return null;
  if (path.startsWith('balance.')) {
    return (ARTIFACT_BALANCE_PATHS as readonly string[]).includes(path.slice('balance.'.length))
      ? null : `balance-Pfad ${path} ist nicht erlaubt`;
  }
  const m = /^(skill|handler):([a-z_]+)\.(.+)$/.exec(path);
  if (!m) return `Pfad ${path} unbekannt`;
  const [, kind, skillId, rest] = m as unknown as [string, string, string, string];
  const sk = skillById.get(skillId);
  if (!sk) return `Fähigkeit ${skillId} existiert nicht`;
  if (sk.class !== a.class) return `${skillId} gehört zu einer fremden Klasse`;
  if (kind === 'skill') {
    if (rest === 'cooldownS') return null;
    const em = /^effects\.(\d+)\.([a-zA-Z]+)$/.exec(rest);
    if (!em) return `Feld ${rest} unbekannt`;
    const e = sk.effects[Number(em[1])];
    if (!e) return `Effekt ${em[1]} existiert nicht`;
    return em[2]! in e ? null : `Feld ${em[2]} existiert nicht in Effekt ${em[1]}`;
  }
  const h = sk.effects.find((e) => e.k === 'handler');
  if (!h || h.k !== 'handler') return `${skillId} hat keinen Handler`;
  return rest in h.params ? null : `Handler-Parameter ${rest} existiert nicht`;
}

export function storyLines(content: Content, chapter: number, key: string): StoryLine[] {
  return content.story[chapter - 1]?.dialogs[key] ?? [];
}
