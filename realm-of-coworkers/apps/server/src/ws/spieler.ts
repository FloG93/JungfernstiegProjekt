// Zustand eines Spielers in einer laufenden Stage (2.5, 11.4 bis 11.6). Beide Kampfarten teilen ihn:
// der Echtzeitkampf (run.ts) und der Rundenkampf (rundenlauf.ts).
import { Rng, SnapshotTracker, deriveSeed } from '@aethra/shared';
import type { ClassId, GameEvent, GemDrop, HeroInput, HeroSetup, ItemDTO } from '@aethra/shared';
import type { RewardResult } from '../game/rewards';

export interface RunPlayerInit {
  accountId: number;
  setup: HeroSetup;
  /** Helfer-Modus am Boss (10.9): Timer läuft, keine Boss-Belohnung. */
  helper: boolean;
  /** Erster Sieg über den Boss dieser Stage. */
  first: boolean;
  /** Eigene Beutestufe K für den Boss (8.2). */
  kampfstufe: number;
  /** Stage schon abgeschlossen: Wiederholung mit 40 % XP (12.2). */
  repeat: boolean;
  /** Nicht bereit beim Start: Autopilot, bis der Spieler eingreift (11.3). */
  autopilot: boolean;
}

interface Totals {
  xp: number;
  weaponXp: number;
  gold: number;
  items: ItemDTO[];
  gems: GemDrop[];
  splinters: number;
  levelUps: number[];
  weaponLevelUps: number[];
  autoSold: { name: string; gold: number }[];
  artifactUnlocked: string | null;
}

export class RunPlayer {
  readonly accountId: number;
  readonly heroId: number;
  readonly classId: ClassId;
  readonly name: string;
  level: number;
  setup: HeroSetup;
  unitId: number | null = null;
  /** Wiedereinstieg läuft (Werte werden geladen). */
  joining = false;
  readonly helper: boolean;
  readonly first: boolean;
  readonly kampfstufe: number;
  readonly repeat: boolean;
  connected = true;
  disconnectedAt = 0;
  autopilot: boolean;
  /** Rundenkampf: Auto-Kampf; der Server wählt für diesen Spieler (ENTWURF 4). */
  auto = false;
  /** Möchte am nächsten Checkpoint bzw. Boss-Tor wieder einsteigen (11.5). */
  wantsRejoin = false;
  endSent = false;
  gateReady = false;
  readonly tracker = new SnapshotTracker();
  needFull = true;
  pending: HeroInput[] = [];
  lastSeq = -1;
  ackedSeq = -1;
  potXp = 0;
  potGold = 0;
  private: GameEvent[] = [];
  readonly totals: Totals = {
    xp: 0, weaponXp: 0, gold: 0, items: [], gems: [], splinters: 0, levelUps: [], weaponLevelUps: [], autoSold: [],
    artifactUnlocked: null,
  };
  /** Datenbankarbeit dieses Spielers läuft nacheinander. */
  chain: Promise<void> = Promise.resolve();
  readonly lootRng: Rng;

  constructor(init: RunPlayerInit, seed: number) {
    this.accountId = init.accountId;
    this.heroId = init.setup.dbId;
    this.classId = init.setup.classId;
    this.name = init.setup.name;
    this.level = init.setup.level;
    this.setup = init.setup;
    this.helper = init.helper;
    this.first = init.first;
    this.kampfstufe = init.kampfstufe;
    this.repeat = init.repeat;
    this.autopilot = init.autopilot;
    // Beute würfelt jeder Spieler mit eigenem Zähler, damit die Welt davon unberührt bleibt (10.8, 12)
    this.lootRng = new Rng(deriveSeed(seed, init.setup.dbId));
  }

  add(r: RewardResult): void {
    const t = this.totals;
    t.xp += r.xpGained;
    t.weaponXp += r.weaponXp;
    t.gold += r.gold;
    t.items.push(...r.items);
    t.gems.push(...r.gems);
    t.splinters += r.splinters;
    t.levelUps.push(...r.levelUps);
    t.weaponLevelUps.push(...r.weaponLevelUps);
    t.autoSold.push(...r.autoSold);
    if (r.artifactUnlocked) t.artifactUnlocked = r.artifactUnlocked;
  }
}
