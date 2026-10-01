## 15 Datenmodell, API und Server-Nachrichten

Alle Typen liegen als TypeScript-Interfaces mit Zod-Schemas in `packages/shared`. Server und Client verwenden dieselben Definitionen (2.2). Alle Nachrichten sind JSON.

### 15.1 Datenbank (SQLite)

Migrationen mit Kysely (2.1). Alle Änderungen eines Vorgangs laufen in einer Transaktion (2.5). Zeiten sind UTC in Millisekunden.

| Tabelle | Spalten (Auszug) | Regeln |
| --- | --- | --- |
| `accounts` | id, username (eindeutig), pw\_hash (argon2id), created\_at, last\_login | Registrierung nur mit Einladungscode (`INVITE_CODE`) |
| `sessions` | token\_hash, account\_id, created\_at, expires\_at | Cookie 30 Tage, httpOnly, sameSite=lax |
| `heroes` | id, account\_id, name, class, appearance (JSON), level, xp, gold, splinters, active\_set (A oder B), autocast (JSON: Skill-ID → an/aus), created\_at | eindeutig (account\_id, class) und (account\_id, name) |
| `items` | id, hero\_id, slot, ilvl, rarity, budget, stats (JSON: leb, kra, rue, res, tmp, krt), ele, name, element, weapon\_level, weapon\_xp, enchants (JSON), effect\_id, equip\_slot, stash (0 oder 1), locked (0 oder 1), created\_at | equip\_slot ist null (Inventar), oder Waffe\_A, Waffe\_B, Ruestung, Nebenhand, Helm, Handschuhe, Umhang, Stiefel. Höchstens 1 Item je equip\_slot und Held |
| `gems` | id, hero\_id, kind, tier, socket (0 bis 8 oder null) | eindeutig (hero\_id, socket), wenn nicht null |
| `artifacts` | hero\_id, slot (amulett, ring, relikt), rank | Primärschlüssel (hero\_id, slot) |
| `boss_state` | hero\_id, boss\_id, first\_kill\_at, last\_kill\_at, kampfstufe (0 bis 4) | Primärschlüssel (hero\_id, boss\_id) |
| `stage_progress` | hero\_id, stage (1 bis 30), clears, best\_time\_ms | Primärschlüssel (hero\_id, stage). Eine Zeile bedeutet: Stage abgeschlossen. Daraus folgt die Freischaltung (3.4) |
| `story_seen` | hero\_id, text\_id | für die Chronik |
| `run_log` | id, seed, party (JSON), stage, started\_at, ended\_at, result, events (komprimiert) | für Wiederholung und Fehlersuche |

**Regeln:**

- `heroes.max_stage` entfällt. Frei sind Stage 1 und jede Stage s, für die stage\_progress einen Eintrag für s − 1 enthält (3.4).
- Das Inventar hat höchstens 80 Gegenstände plus 40 in der Überlauftruhe (8.9): Feld `stash` (0 oder 1) im Item.
- Beute wird beim Drop sofort geschrieben (2.5). Bei einem Serverabsturz gehen nur Werte der laufenden Begegnung verloren.
- Der Server berechnet Werte (Abschnitt 5) aus Basiswerten, Items, Gems, Artefakten und Verzauberung bei jedem Laden neu. Abgeleitete Werte werden nicht gespeichert.

### 15.2 HTTP-Schnittstelle

Basis `/api`, JSON, Cookie-Sitzung. Erfolg: `{ ok: true, data }`. Fehler: `{ ok: false, error: { code, message } }`. Mutationen sind POST, PUT oder DELETE.

| Methode und Pfad | Zweck |
| --- | --- |
| POST `/api/register` | Konto anlegen (username, password, inviteCode) |
| POST `/api/login`, POST `/api/logout`, GET `/api/me` | Sitzung |
| GET `/api/heroes`, POST `/api/heroes`, DELETE `/api/heroes/:id` | Helden auflisten, erstellen, löschen (Namensbestätigung) |
| PUT `/api/heroes/:id/appearance` | Aussehen ändern |
| GET `/api/heroes/:id` | Voller Zustand: Werte, Ausrüstung, Inventar, Gems, Artefakte, Timer |
| POST `/api/heroes/:id/equip`, `/unequip`, `/sell` | Ausrüsten, Ablegen, Verkaufen |
| POST `/api/heroes/:id/gems/socket`, `/unsocket`, `/combine`, `/swap` | Juwelier (7.3, 7.4) |
| POST `/api/heroes/:id/weapons/element`, `/transfer`, `/enchant` | Schmiede (8.4, 8.7) |
| POST `/api/heroes/:id/artifacts/upgrade` | Archiv (7.6) |
| GET `/api/heroes/:id/bosses` | Bosstafel: Status, Timer, Kampfstufe |
| GET `/api/online` | Online-Liste (11.1) |
| GET `/content/*.json` | Statische Inhalte, mit Hash im Dateinamen oder ETag |
| GET `/api/health` | Zustand des Servers (Runs, Version) |

Ergänzend: POST /api/heroes/:id/items/:itemId/lock und /stash (Sperren und Überlauftruhe, 8.9). Alle Eingaben werden mit Zod geprüft. Der Held muss dem Konto gehören (403 sonst). Mutationen während eines laufenden Runs sind für den Helden gesperrt (409 `HERO_IN_RUN`).

**Fehlercodes:** `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `HERO_IN_RUN`, `NOT_ENOUGH_GOLD`, `NOT_ENOUGH_SPLINTERS`, `INVENTORY_FULL`, `REQUIREMENT_NOT_MET`, `NAME_TAKEN`, `RATE_LIMITED`, `SERVER_BUSY`.

### 15.3 WebSocket-Protokoll

- Endpunkt `/ws`, Anmeldung über das Sitzungs-Cookie. Genau eine Verbindung je Konto (11.9).
- Jede Nachricht ist ein JSON-Objekt mit `t` (Typ). Die erste Nachricht des Clients ist `hello` mit der Protokollversion `v`. Bei Abweichung schließt der Server mit Code 4001.
- Höchstens 30 Nachrichten pro Sekunde je Client (2.3). Zu große oder ungültige Nachrichten werden verworfen und geloggt.

**Client an Server:**

| `t` | Felder | Zweck |
| --- | --- | --- |
| `hello` | v, heroId | Anmeldung mit gewähltem Helden |
| `party.create` |  | Party anlegen |
| `party.join` | code | Beitritt per Code |
| `party.invite` | targetAccountId | Einladung senden |
| `party.answer` | inviteId, accept | Einladung beantworten |
| `party.leave`, `party.kick` | targetAccountId (nur kick) | Verlassen oder entfernen |
| `party.setStage` | stage | Stage wählen (Anführer) |
| `party.ready` | ready | Bereit-Status |
| `party.start` |  | Start (Anführer) |
| `party.chat` | text | Chat (200 Zeichen) |
| `run.input` | seq, mx, my, act | Eingabe (siehe unten) |
| `run.autocast` | skillId, on | Auto-Cast umschalten |
| `run.ping` | kind, x, y | Ping (Hinweis, Achtung, Hilfe) |
| `run.autowalk` | on | Autowalk (Anführer) |
| `run.pause` | on | Pause (nur Solo) |
| `run.ready` |  | Boss-Bereitschaft bestätigen |
| `run.leave` |  | Run verlassen |

`run.input.act` ist eine Liste von Aktionen: `{ k: 'skill', id, target? }`, `{ k: 'roll' }`, `{ k: 'swap' }`, `{ k: 'potion' }`, `{ k: 'focus', targetId }`, { k: 'revive', targetId }. `mx`, `my` sind die Bewegungsrichtung (−1, 0, 1) oder ein Zielpunkt. Höchstens 20 Eingaben pro Sekunde (2.3).

**Server an Client:**

| `t` | Felder | Zweck |
| --- | --- | --- |
| `welcome` | v, serverTime, contentHash, heroState | Antwort auf hello |
| `presence` | list | Online-Liste, Änderungen |
| `party.state` | code, leader, members, stage, readyMap | Zustand der Party |
| `party.invited` | inviteId, from | Einladung erhalten (eigener Name, damit die Richtung eindeutig ist) |
| `run.start` | runId, seed, stage, roster, n, config | Beginn des Countdowns |
| `run.snapshot` | tick, full, ents, rm, zones | Delta-Snapshot (10 Hz). Projektile sind Einheiten mit kind 'proj' |
| `run.events` | tick, list | Ereignisse (sofort) |
| `run.ack` | seq | Bestätigung der letzten Eingabe |
| `run.end` | result, xp, weaponXp, gold, loot, gems, splinters, levelUps | Ergebnis |
| `error` | code, message | Fehler |

### 15.4 Snapshot und Ereignisse

```ts
interface Entity {
  id: number; kind: 'hero' | 'enemy' | 'boss' | 'add' | 'proj';
  x: number; y: number; face: -1 | 1;           // ganze Pixel
  hp: number; maxHp: number; shield?: number;
  state: 'idle' | 'walk' | 'attack' | 'cast' | 'roll' | 'stun' | 'dead';
  fx?: { id: string; stacks: number; ms: number }[]; // höchstens 8
  el?: 'physisch' | 'feuer' | 'eis' | 'blitz' | 'erde' | 'licht' | 'schatten';
  cd?: Record<string, number>;                    // nur eigener Held
}
interface Snapshot {
  t: 'run.snapshot'; tick: number; full: boolean;
  ents: Entity[];                                 // geänderte oder alle bei full
  rm: number[];                                   // entfernte Ids
  zones: { id: number; shape: 'circle' | 'line' | 'cone'; x: number; y: number;
           w: number; h: number; ang?: number; endsAt: number; kind: 'telegraph' | 'hazard' | 'aura' }[];
}
type GameEvent =
  | { e: 'hit'; src: number; dst: number; dmg: number; crit?: boolean; el?: string }
  | { e: 'heal'; src: number; dst: number; amount: number }
  | { e: 'death' | 'revive'; id: number }
  | { e: 'cast'; id: number; skill: string }
  | { e: 'fx'; id: number; fx: string; add: boolean }
  | { e: 'telegraph'; zone: number; ms: number }
  | { e: 'phase'; boss: number; phase: 1 | 2 | 3; el: string }
  | { e: 'encounter'; index: number; state: 'start' | 'end' }
  | { e: 'checkpoint'; index: number }
  | { e: 'loot'; kind: 'item' | 'gem' | 'splinter' | 'gold'; ref: object }
  | { e: 'levelup'; heroId: number; level: number }
  | { e: 'chat'; from: number; text: string }
  | { e: 'ping'; from: number; kind: string; x: number; y: number };
```

Snapshots enthalten nur Änderungen. Vollständige Snapshots kommen beim Beitritt, beim Wiederverbinden und alle 5 Sekunden (11.7).

### 15.5 Inhaltsdateien

Alle Zahlen in Abschnitten 4 bis 12 stehen als Daten in `packages/content`. Der Content-Loader (2.3) validiert sie beim Start. Fehler brechen den Start ab. Die Schemas sind Zod-Definitionen in `packages/shared/src/content.ts`; hier die Struktur:

| Datei | Inhalt | Abschnitt |
| --- | --- | --- |
| `balance.json` | Konstanten: Faktoren F, M, C, H, Kampfstufe-Prozent, XP-Kurve, Gold, Timer, Grenzen | 5, 9 bis 13 |
| `classes.json` | 6 Klassen: Anteile, Leben-Faktor, Bedrohung, Reichweite, Solo-Multiplikator | 4, 5 |
| `skills.json` | Fähigkeiten und Passive je Klasse | 4 |
| `status.json` | Buffs und Debuffs | 6.3 |
| `elements.json` | Elemente, Farben, Gegenelemente | 6.1 |
| `items/names.json` | Präfixe, Typen und Suffixe, Materialgruppen | 8.3 |
| `gems.json` | Gem-Arten, Stufen, Kosten, Beute | 7 |
| `artifacts.json` | 18 Artefakte | 7.7 |
| `enemies.json` | 9 Gegnertypen und das Objekt elite | 9.3 |
| `bosses.json` | 6 Bosse | 10 |
| `arenas.json` | Arenen | 10.2 |
| `levels/stage-01.json` bis `stage-30.json` | Stages | 9 |
| `levels/palette.json` | Paletten je Kapitel | 9.5 |
| `loot/stage-loot.json` | Stage-Beute | 12.8 |
| `loot/boss-drops.json` | Boss-Beute | 10.8 |
| `story/kapitel1.json` bis `kapitel6.json` | Texte und Dialoge | 3.2 |
| `i18n/de.json` | Oberflächentexte | 14.10 |

Strukturen der wichtigsten Dateien:

```ts
// ---------- IDs (verbindlich, ASCII, kleingeschrieben) ----------
type ClassId   = 'krieger' | 'magier' | 'waldlaeufer' | 'schurke' | 'kleriker' | 'runenweber';
type ElementId = 'physisch' | 'feuer' | 'eis' | 'blitz' | 'erde' | 'licht' | 'schatten';
type StatId    = 'leb' | 'kra' | 'rue' | 'res' | 'tmp' | 'krt' | 'ksd' | 'ele';
type SlotId    = 'waffe' | 'ruestung' | 'nebenhand' | 'helm' | 'handschuhe' | 'umhang' | 'stiefel';
type RarityId  = 'gewoehnlich' | 'ungewoehnlich' | 'selten' | 'episch' | 'legendaer';
type EnemyId   = 'scherge' | 'hetzer' | 'schuetze' | 'schwarmling' | 'brecher' | 'priester' | 'kultist' | 'bomber' | 'waechter';
type BossId    = 'ignarch' | 'glaciara' | 'voltrax' | 'gorthul' | 'solaris' | 'nyxhara';
type GemId     = 'granat' | 'rubin' | 'onyx' | 'aquamarin' | 'topas' | 'saphir' | 'smaragd';
type StatusId =
  | 'verbrennung' | 'frost' | 'eingefroren' | 'schock' | 'ruestungsbruch' | 'blendung' | 'verderbnis'
  | 'gift' | 'blutung' | 'betaeubung' | 'wurzel' | 'furcht' | 'runenbruch' | 'verspottet'
  | 'angriffstempo_malus' | 'bewegung_malus'
  | 'schild' | 'regeneration' | 'raserei' | 'kraftrune' | 'schutzrune' | 'runensturm' | 'adlerauge'
  | 'tarnung' | 'bollwerk' | 'spott_schutz' | 'unverwundbar';
// Skill-IDs: '<ClassId>_<name>', vollständige Liste in der Tabelle unter diesem Block.
// Artefakt-IDs: '<ClassId>_<amulett|ring|relikt>', zum Beispiel 'krieger_amulett'.

// ---------- Klassen und Fähigkeiten ----------
interface ClassDef {
  id: ClassId; name: string; role: string; weapon: string; offhand: string; material: string;
  rangePx: number; hpFactor: number; threat: number; solo: number;   // 4.2, 4.4
  formationOffsetPx: number;                                          // 6.5
  shares: Record<'leb' | 'kra' | 'rue' | 'res' | 'tmp' | 'krt', number>; // 5.4, Summe 1
  skills: string[];                                                   // auto, s1, s2, s3, ult, passive
}
interface SkillDef {
  id: string; class: ClassId; slot: 'auto' | 's1' | 's2' | 's3' | 'ult' | 'passive';
  unlockLevel: number; cooldownS: number;                             // 0 bei Passiven
  target: 'nearest' | 'focus' | 'lowestAlly' | 'self' | 'ground' | 'none';
  rangePx?: number;                                                   // Standard: Reichweite der Klasse
  autoCast?: { default: boolean; rule: AutoCastRule };                // fehlt bei Passiven
  effects: Effect[];                                                  // in dieser Reihenfolge anwenden
}
type AutoCastRule =
  | { when: 'enemyInRange' } | { when: 'inCombat' } | { when: 'bossPresent' }
  | { when: 'allyHasDebuff' } | { when: 'allyDead' }
  | { when: 'enemiesNear'; count: number; radiusPx: number }          // um den Helden
  | { when: 'allyBelowPct'; pct: number }
  | { when: 'alliesBelowPct'; pct: number; count: number }
  | { when: 'selfBelowPct'; pct: number }
  | { when: 'any'; rules: AutoCastRule[] };
type EffectTo = 'target' | 'self' | 'allies' | 'lowestAllies' | 'enemiesAroundSelf' | 'enemiesAroundTarget';
type Effect = { to?: EffectTo; count?: number; radiusPx?: number } & (   // to Standard: 'target'; 'allies' schließt den Wirker ein
  | { k: 'damage'; coef: number; splashPct?: number }
  | { k: 'heal'; coef?: number; pctMaxHp?: number }
  | { k: 'shield'; pctMaxHpOf: 'self' | 'caster'; pct: number; ms: number }
  | { k: 'status'; id: StatusId; ms: number; stacks?: number; chance?: number;
      value?: number;                                                 // Koeffizient oder Prozent laut StatusDef
      bossReplace?: Effect }                                          // Ersatz bei Boss-Immunität
  | { k: 'buff'; stat: StatId | 'dmgDealt' | 'dmgTaken' | 'rangePx' | 'moveSpeed';
      mult?: number; add?: number; ms: number; display?: StatusId }                       // ms 0 = dauerhaft
  | { k: 'handler'; id: HandlerId; params: Record<string, number | string | boolean> });

// Mechaniken, die das Schema nicht ausdrückt. Je Handler eine Datei in
// packages/shared/src/sim/handlers/<id>.ts mit eigenem Test. Zahlen nur aus params.
type HandlerId =
  | 'taunt' | 'pierce' | 'trap' | 'barrage' | 'conditionalBonus' | 'teleportBehind' | 'channelSpin'
  | 'groundDelayed' | 'cleanse' | 'revive' | 'overhealShield' | 'cooldownResetOnSwap'
  | 'buffedDamageReduction' | 'rollCooldown' | 'modifyValue'
  | 'boss_glutmantel' | 'boss_eispanzer' | 'boss_statische_ladung' | 'boss_steinhaut'
  | 'boss_sonnenschild' | 'boss_schattenhuelle'
  | 'sig_glutregen' | 'sig_frostnova' | 'sig_kettenblitz' | 'sig_beben' | 'sig_strahlenbuendel' | 'sig_stille'
  | 'enemy_priest_heal' | 'enemy_bomber' | 'enemy_guardian_shield' | 'enemy_cultist_orb' | 'elite_slam'
  | 'affix_schild' | 'affix_rasend' | 'affix_blutsauger' | 'affix_regenerierend'
  | 'hazard_feuersaeule' | 'hazard_eisbrocken' | 'hazard_blitz' | 'hazard_wurzel'
  | 'hazard_lichtstrahl' | 'hazard_schattenzone';
// modifyValue ändert einen Datenwert für den Träger, Pfade:
//   'skill:<skillId>.cooldownS', 'skill:<skillId>.effects.<i>.<feld>', 'handler:<skillId>.<param>',
//   'status:<statusId>.<feld>', 'balance.<pfad>', 'self.buffDurationMs' (alle Buffs des Trägers)
//   params: { path, add?, mult?, set? }, zum Beispiel { path: 'skill:krieger_spott.cooldownS', add: -2 }

interface StatusDef {
  id: StatusId; kind: 'buff' | 'debuff'; maxStacks: number; defaultMs: number; tickMs?: number;
  weakening: boolean;          // zählt als Schwächung (6.3)
  cleanseOrder?: number;       // Reihenfolge 6.4, 1 = zuerst
  bossImmune: boolean; eliteDurationMult: number;   // 6.4
  params: Record<string, number>;                   // zum Beispiel { dmgTakenPctPerStack: 10 }
  // 'value' einer Fähigkeit überschreibt: gift, blutung, verbrennung, regeneration -> heroCoefPerS;
  // angriffstempo_malus -> attackSpeedMalusPct; bewegung_malus -> moveSpeedMalusPct; runenbruch -> dmgTakenPct
}

// ---------- Gegner, Bosse, Arenen, Stages ----------
interface EnemyDef {
  id: EnemyId; hpMult: number; dmgMult: number; armorMit: number; resMit: number;
  speed: number; rangePx: number; intervalS: number; element: 'physisch' | 'kapitel';
  weight: number; groupSize: number; ai: 'melee' | 'ranged' | 'support' | 'bomber' | 'guardian';
  handlers: { id: HandlerId; params: Record<string, number | string> }[];
}
interface EliteDef {           // enemies.json, Feld elite (9.7)
  hpMult: number; dmgMult: number; armorMit: number; resMit: number; weight: number;
  replacesPoints: number; bases: EnemyId[]; basesFromChapter: Partial<Record<EnemyId, number>>;
  affixes: HandlerId[]; slam: { everyS: number; telegraphMs: number; radiusPx: number; pctRefHp: number };
  itemChance: number;
}
interface Attack {
  intervalMs: number; pctRefHp: number; dmgType: 'phys' | 'elem';
  shape: 'single' | 'all' | 'circle' | 'handler'; radiusPx?: number; telegraphMs?: number;
  fromPhase?: 1 | 2 | 3; handler?: HandlerId; params?: Record<string, number | string>;
}
interface BossDef {
  id: BossId; chapter: number; name: string; hpBase: number; element: ElementId;
  armorMit: number; resMit: number; timerMinutes: number;
  phases: { fromPct: number; toPct: number; element: ElementId }[];
  attacks: { standard: Attack; pulse: Attack; telegraph: Attack; signature: Attack };
  passive: { id: HandlerId; params: Record<string, number | string> };
  debuff: StatusId;
  weapon: { status: StatusId; stacks: number; chance: number };      // 8.5
  adds: { enemy: 'schwarmling'; firstAtS: number; everyS: number; groupsPerWave: number };
  arena: string; dialog: { before: string; after: string };           // Story-Schlüssel
}
// Arena-ID 'arena_<region>', Hintergrund 'bg_<region>_arena', Stage-Hintergrund 'bg_<region>'
interface ArenaDef { id: string; widthPx: number; depthPx: number; heroStartX: [number, number]; bossStartX: number; background: string }
interface StageDef {
  stage: number; chapter: number; recommendedLevel: number; lengthPx: number;
  encounters: { x: number; points: number; groupSplit: number[]; groupDelaysS: number[]; elites: number; hazard: boolean }[];
  checkpoints: number[]; hazard: HandlerId | null; boss?: BossId; introId: string; loot: 'normal' | 'boss';
}
type PaletteFile = Record<string /* Kapitel '1'..'6' */, Partial<Record<EnemyId, number>>>; // Prozent, Summe 100

// ---------- Beute, Gems, Artefakte ----------
interface StageLootFile {
  itemsPerChest: number; eliteItemChance: number; gemChance: number; splinters: number;
  slotWeights: Record<SlotId, number>;
  rarityByChapter: Record<string, Partial<Record<RarityId, number>>>;
  weaponElement: Record<ElementId, number>;
}
interface BossDropsFile {
  first:  { weapon: number; item: Partial<Record<RarityId, number>>; gem: number; splinters: number; goldFactor: number; xpFactor: number };
  repeat: { weapon: number; item: Partial<Record<RarityId, number>>; gem: number; splinters: number; goldFactor: number; xpFactor: number };
  itemSlotWeights: Record<SlotId, number>; elementCoreChance: number;
}
interface GemFile {
  kinds: { id: GemId; stat: StatId }[]; tierPoints: number[]; tierNames: string[];
  combineCostMult: number; swapCostMult: number; slotUnlockLevels: number[];
  chestTierByChapter: Record<string, number[]>;   // Wahrscheinlichkeiten Stufe I..V
  bossTierOffset: number;
}
interface ArtifactDef {
  id: string; class: ClassId; slot: 'amulett' | 'ring' | 'relikt'; name: string;
  unlockBoss: BossId; rankPoints: number[]; rankCost: number[]; effect: Effect;  // meist modifyValue
}

// ---------- Texte ----------
interface StoryFile {
  chapter: number;
  stageIntros: Record<string /* 'stage-07' */, string>;
  dialogs: Record<string /* 'ignarch_before' */, { speaker: string; text: string }[]>;
  epilogue?: { speaker: string; text: string }[];
}
interface NamesFile {
  prefixes: Record<RarityId, string[]>; suffixes: string[];
  types: Record<ClassId, Record<SlotId, string>>;       // zum Beispiel krieger.helm = 'Plattenhelm'
  bossGenitive: Record<BossId, string>;                 // 'des Glutkönigs'
}
interface ElementDef { id: ElementId; color: string; icon: string; weakTo: ElementId | null }
```

**Fähigkeiten als Daten.** Diese Tabelle legt für jede Fähigkeit die ID, die Effekte und die Auto-Cast-Regel fest. Ultimates haben Auto-Cast standardmäßig aus, alle anderen an. Zahlen stammen aus Abschnitt 4.

| Skill-ID | Slot | Effekte | Auto-Cast-Regel |
| --- | --- | --- | --- |
| krieger\_schwerthieb | auto | damage 0,78 | enemyInRange |
| krieger\_spott | s1 | handler taunt (Radius 300, 4 s, Boss: Bedrohung Maximum + 10 %), damage 0,30 enemiesAroundSelf 300, buff dmgTaken ×0,7 self 4 s | any(enemiesNear 2 in 300, bossPresent) |
| krieger\_schildstoss | s2 | damage 1,60, status betaeubung 1,5 s, bossReplace angriffstempo\_malus 20 % 3 s | enemyInRange |
| krieger\_wirbelhieb | s3 | damage 1,20 enemiesAroundSelf 120 | enemiesNear 2 in 120 |
| krieger\_bollwerk | ult | shield 15 % Max-Leben des Wirkers an allies 6 s, buff dmgTaken ×0,6 self 6 s | any(alliesBelowPct 60 count 2, selfBelowPct 40) |
| krieger\_standhaft | passive | buff rue ×1,15 dauerhaft (Bedrohung ×3,0 steht in classes.json) | – |
| magier\_arkanblitz | auto | damage 0,75 | enemyInRange |
| magier\_elementarkugel | s1 | damage 2,40, splashPct 60 im Radius 100 | enemyInRange |
| magier\_elementarnova | s2 | damage 2,60 enemiesAroundTarget 220 | enemyInRange |
| magier\_arkane\_barriere | s3 | shield 20 % eigenes Max-Leben self 6 s | selfBelowPct 80 |
| magier\_kataklysmus | ult | handler groundDelayed (Radius 300, Verzögerung 1,0 s, coef 12,0) | enemiesNear 4 in 300 |
| magier\_elementarfluss | passive | handler cooldownResetOnSwap (Skill magier\_elementarkugel, Sperre 20 s) | – |
| waldlaeufer\_pfeilschuss | auto | damage 0,70 | enemyInRange |
| waldlaeufer\_gezielter\_schuss | s1 | handler pierce (coef 2,60, zweites Ziel 50 %) | enemyInRange |
| waldlaeufer\_fallensteller | s2 | handler trap (Radius 80, 15 s, höchstens 2, coef 1,60, wurzel 2 s, Boss: bewegung\_malus 30 % 3 s) | enemyInRange |
| waldlaeufer\_pfeilhagel | s3 | handler barrage (5 Pfeile à 0,70 in 1,5 s, Radius 150) | enemyInRange |
| waldlaeufer\_adlerauge | ult | buff dmgDealt ×1,3 und rangePx +100, self 10 s | bossPresent |
| waldlaeufer\_faehrtenleser | passive | buff moveSpeed ×1,1 dauerhaft, handler rollCooldown (7 s) | – |
| schurke\_doppelstich | auto | damage 0,65 | enemyInRange |
| schurke\_meucheln | s1 | handler conditionalBonus (coef 2,80, ×1,5 bei gift, blutung, verbrennung oder Schwächung) | enemyInRange |
| schurke\_giftklinge | s2 | status gift 6 s, value 0,35 | enemyInRange |
| schurke\_schattenschritt | s3 | handler teleportBehind (coef 1,00, tarnung 2 s, nächster Treffer +25 %) | enemyInRange |
| schurke\_klingentanz | ult | handler channelSpin (6 Treffer à 0,90 in 1,5 s, Radius 90, unverwundbar) | enemiesNear 3 in 90 |
| schurke\_blutdurst | passive | buff krt +10 dauerhaft | – |
| kleriker\_heiliger\_schlag | auto | damage 0,60 | enemyInRange |
| kleriker\_heilendes\_licht | s1 | heal 2,00 lowestAllies count 1 | allyBelowPct 90 |
| kleriker\_segensaura | s2 | status regeneration 8 s, value 0,25, lowestAllies count 3 | allyBelowPct 90 |
| kleriker\_laeuterung | s3 | handler cleanse (1 Debuff je Verbündetem), heal 1,20 allies, damage 0,80 enemiesAroundSelf 300 | any(allyHasDebuff, alliesBelowPct 80 count 2) |
| kleriker\_wunder | ult | heal 60 % Max-Leben allies, handler revive (30 %) | any(allyDead, alliesBelowPct 40 count 2) |
| kleriker\_gnade | passive | handler overhealShield (höchstens 10 % Max-Leben, 6 s) | – |
| runenweber\_runenstrahl | auto | damage 0,73 | enemyInRange |
| runenweber\_rune\_der\_kraft | s1 | buff kra ×1,15 allies 8 s | inCombat |
| runenweber\_runenbruch | s2 | status runenbruch 8 s, damage 1,00 | enemyInRange; target focus: Fokusziel, sonst Boss, dann Elite, dann nächster Gegner |
| runenweber\_rune\_des\_schutzes | s3 | buff rue ×1,2 und res ×1,2 allies 8 s | inCombat |
| runenweber\_runensturm | ult | buff tmp +25 und krt +20 allies 12 s | bossPresent |
| runenweber\_resonanz | passive | handler buffedDamageReduction (5 %) | – |

**Artefakte** (7.7) sind Effekte vom Typ `modifyValue`, zum Beispiel `krieger_amulett`: `{ path: 'balance.combat.potion.pct', set: 45 }` und `krieger_ring`: `{ path: 'skill:krieger_spott.cooldownS', add: -2 }`. Ein Artefakt darf nur Fähigkeiten und Handler der eigenen Klasse ändern. Über `balance.` sind nur `combat.potion.pct`, `combat.potion.cooldownS`, `combat.roll.px`, `combat.roll.cooldownS` und `combat.revive.channelS` erlaubt.

**Startwerte von `balance.json`** (vollständig, alle Werte aus den Abschnitten 4 bis 12):

```json
{
  "stats": {
    "perPoint": { "leb": 6, "kra": 0.5, "rue": 1, "res": 1, "tmp": 0.15, "krt": 0.10, "ksd": 0.4 },
    "base": { "leb": [120, 14], "kra": [10, 2.2], "rue": [10, 2.4], "res": [8, 2.0], "tmp": 0, "krt": 5, "ksd": 150 },
    "caps": { "tmp": 40, "krt": 60, "krtBuffed": 75, "ksd": 250, "ele": 15 },
    "maxLevel": 30, "levelUpHealPct": 30
  },
  "items": {
    "slotWeights": { "waffe": 2.0, "ruestung": 1.4, "nebenhand": 1.2, "helm": 1.0, "handschuhe": 0.8, "umhang": 0.8, "stiefel": 0.8 },
    "rarity": { "gewoehnlich": 1.00, "ungewoehnlich": 1.12, "selten": 1.28, "episch": 1.48, "legendaer": 1.75 },
    "budget": { "base": 8, "perIlvl": 2.2 }, "rollJitter": [0.92, 1.08], "maxIlvl": 34, "reqOffset": 4,
    "legendaryElePct": 1, "sellDivisor": 4, "inventory": 80, "stash": 40
  },
  "weapon": {
    "xp": { "mult": 300, "exp": 1.4, "round": 10, "share": 0.5, "shareAtMaxLevel": 1.0 },
    "bonusPerLevel": 0.03, "maxLevel": 10, "swapMs": 500, "swapLockS": 4,
    "transferGoldPerLevel": 300, "elementChangeGoldPerIlvl": 20,
    "enchant": { "lines": 3, "maxRank": 5, "goldPerRankSq": 100, "changeTypeGold": 500 }
  },
  "combat": {
    "tickRate": 20, "mitigation": { "base": 40, "perLevel": 12 },
    "roll": { "px": 160, "invulnMs": 500, "cooldownS": 8 },
    "revive": { "channelS": 3, "pct": 30 }, "potion": { "charges": 4, "pct": 35, "cooldownS": 15 },
    "maxEffects": 8, "threatSwitch": 1.10, "healThreat": 0.5, "meleeSlots": 4, "telegraphMs": 1500
  },
  "movement": { "manual": 220, "autowalk": 90, "leashPx": 700, "formationReturnS": 3, "sameClassDepthPx": 40 },
  "enemy": { "life": { "base": 60, "perLevel": 38 }, "damage": { "base": 1, "perLevel": 0.35 } },
  "stage": {
    "lengthPx": 12000, "encounterX": [1800, 3600, 5400, 7200, 9000, 10800], "encounterPoints": [8, 10, 10, 12, 12, 14],
    "groupSplit": [[0.5, 0.5], [0.5, 0.5], [0.4, 0.3, 0.3], [0.4, 0.3, 0.3], [0.4, 0.3, 0.3], [0.4, 0.3, 0.3]],
    "groupDelaysS": [0, 8, 16], "minGroupSize": 3, "restDropBelow": 0.3, "spawnRightShare": 0.7,
    "maxAlive": 30, "resumeBelow": 24, "rushAfterS": 45, "rushSpeed": 160,
    "checkpointX": [4500, 8100], "regenBetweenPct": 4, "reviveAtEncounterEndPct": 50,
    "intro": { "stages": [1, 2, 3, 4], "mult": 0.8 },
    "hazard": { "encounters": [3, 5], "pctRefHp": 4, "everyS": 6, "telegraphMs": 1500 },
    "bossStage": { "encounterX": [1800, 3600], "encounterPoints": [8, 10], "checkpointX": [2700, 4500], "lengthPx": 4500 }
  },
  "party": { "maxSize": 6, "spawnCount": { "perExtra": 0.5 }, "life": { "perExtra": 0.75 }, "lateJoinerLevels": 3 },
  "boss": {
    "damage": { "base": 0.25, "perExtra": 0.15 }, "kampfstufeProzent": 5, "kampfstufeMax": 4, "levelPerChapter": 5,
    "refLife": [407, 611, 815, 1019, 1223, 1427],
    "enrage": { "seconds": 480, "bonus": 0.25, "stepSeconds": 30, "stepBonus": 0.10 },
    "phaseTransition": { "invulnMs": 5000, "healPct": 25, "revivePct": 50 },
    "rage": { "everyS": 15, "ms": 4000 }, "moveSpeed": 80, "meleeRangePx": 130, "slowCapPct": 40,
    "readyCountdownS": 10, "timersMinutes": [15, 25, 40, 60, 90, 120]
  },
  "progression": {
    "xpCurve": { "mult": 100, "exp": 1.5, "round": 10 },
    "xpFactors": { "bossStageEncounters": 0.4, "bossFirst": 1.0, "bossRepeat": 0.5, "stageRepeat": 0.4, "helper": 0 }
  },
  "gold": { "stage": { "perPoint": 66, "base": 2, "perStage": 0.6 }, "bossStagePoints": 18, "bossFirst": 2.0, "bossRepeat": 1.0, "stageRepeat": 1.0 },
  "artifacts": { "splinters": { "stage": 2, "bossFirst": 6, "bossRepeat": 3 } },
  "session": { "soloPauseMaxS": 600, "inviteTtlS": 60, "awayAfterS": 600, "chatMaxLen": 200 },
  "net": { "snapshotEveryTicks": 2, "fullSnapshotS": 5, "maxInputsPerS": 20, "maxMsgsPerS": 30,
           "disconnectGraceS": 90, "emptyRunTimeoutS": 300, "maxRuns": 10, "maxSnapshotBytes": 8192 }
}
```

Dateien mit mehreren Definitionen sind JSON-Arrays dieser Definitionen, Einzelobjekte sind balance.json, palette.json und die Beute-Dateien. Bei target nearest hat ein gesetztes Fokusziel in Reichweite Vorrang. Der Content-Loader prüft zusätzlich: Anteile je Klasse ergeben 1, Paletten je Kapitel 100, Beutetabellen je Kapitel 100, jede referenzierte ID existiert.

### 15.6 Versionen und Kompatibilität

- Protokollversion `v` im `hello` (jetzt 1). Ein Client mit anderer Version erhält den Hinweis „Bitte Seite neu laden“.
- `contentHash` im `welcome` gilt für alle Inhaltsdateien. Weicht er ab, lädt der Client die Inhalte neu.
- Die Datenbank trägt eine Schemaversion (Kysely-Migrationen), Rollback wird nicht unterstützt (Sicherung der Datei `aethra.db` vor jedem Deployment, Abschnitt 16).
- Änderungen an Inhaltsdateien während eines laufenden Runs wirken erst im nächsten Run.
