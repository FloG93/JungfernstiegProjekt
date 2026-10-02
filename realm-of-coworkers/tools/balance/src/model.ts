// Referenzmodell (Abschnitt 13, Anhang A) als TypeScript-Port von ref_model.py.
// Spielwerte kommen aus den JSON-Inhalten; nur die Modellannahmen aus 13.11 stehen hier (sie gehören nicht in die Spieldaten).
import { CLASS_IDS, Rng } from '@aethra/shared';
import type { ClassId, Content, RarityId, SlotId } from '@aethra/shared';

// ---------- Modellannahmen (13.11) ----------
export const ASSUMPTIONS = {
  /** K je Klasse (13.2): Summe Koeffizient ÷ Abklingzeit. Wird zusätzlich in der Simulation gemessen (13.10). */
  k: { krieger: 1.11, magier: 1.64, waldlaeufer: 1.63, schurke: 1.62, kleriker: 0.65, runenweber: 0.78 } as Record<ClassId, number>,
  dpsClasses: ['magier', 'waldlaeufer', 'schurke'] as ClassId[],
  bossMit: 0.25,
  trashMit: 0.15,
  rune: 0.128,
  runeInEncounters: 0.9,
  aoe: { krieger: 1.1, magier: 1.8, waldlaeufer: 1.3, schurke: 1.0, kleriker: 1.05, runenweber: 1.0 } as Record<ClassId, number>,
  /** Mittlerer Krit-Bonus: 1 + Krit-Chance × (KSD − 100 %) (13.2). */
  teleHit: 0.3,
  teleHitTank: 0.25,
  teleHitGroup: 0.15,
  sigActive: 0.66,
  rageOnTank: 0.73,
  tankTools: 0.84,
  /** Standhaft: Rüstung des Kriegers +15 % (4.5). */
  kriegerArmor: 1.15,
  tankAttackers: 4,
  soloAttackers: 3,
  /** Spielerfaktor schlecht / typisch / gut und Elementfaktor falsch / gemischt / richtig (13.5). */
  player: [0.7, 0.75, 0.85] as const,
  element: [0.7, 1.25, 1.45] as const,
  /** Erwartete Stärke aus Gems, Artefakten und Waffenstufe (13.8). */
  strength: { 3: 1.22, 6: 1.42 } as Record<number, number>,
  randomGroups: 6000,
  randomSeed: 3,
  /** Ausrüstung am Kapitelende laut 12.9, Waffenstufe, Gems, Artefakte (7.8), Verzauberung (13.8). */
  gear: [0.77, 0.89, 0.96, 1.01, 1.05, 1.07],
  gemPoints: [9, 37, 70, 99, 152, 178],
  artifactPoints: [24, 30, 54, 60, 84, 90],
  weaponLevel: [3, 6, 8, 10, 10, 10],
  enchant: [0, 0, 0, 0.05, 0.1, 0.15],
  endgameEnchant: 1.19,
  /** Legendäre Bosswaffe im Ausbau A: Zuschlag auf das Waffenbudget (Anhang A). */
  bossWeaponShare: 0.27,
  lootRuns: 3000,
  lootSeed: 1,
  /** Elite-Zusatzgegenstand je Stage-Nummer im Kapitel (Näherung 13.11). */
  eliteByStageInChapter: [0, 0, 0.25, 0.5],
  bossItemEpic: 0.85,
  /**
   * Angriffsprofil der Bosse im Modell (10.4): Anteil von RefLeben und Abstand in Sekunden. Einzelne Bosse dürfen
   * schwächer zuschlagen (zum Beispiel Voltrax' Signatur), aber nicht stärker; das prüft pnpm balance.
   */
  bossProfile: {
    standard: { pctRefHp: 11, intervalMs: 2500 },
    pulse: { pctRefHp: 8, intervalMs: 12000 },
    telegraph: { pctRefHp: 30, intervalMs: 20000 },
    signature: { pctRefHp: 20, intervalMs: 30000 },
  },
} as const;

type StatKey = 'LEB' | 'KRA' | 'RUE' | 'RES' | 'TMP' | 'KRT';
export type Stats = Record<StatKey, number>;
const STAT_KEYS: StatKey[] = ['LEB', 'KRA', 'RUE', 'RES', 'TMP', 'KRT'];
const SLOTS: SlotId[] = ['waffe', 'ruestung', 'nebenhand', 'helm', 'handschuhe', 'umhang', 'stiefel'];

export class Model {
  readonly classes: ClassId[] = [...CLASS_IDS];
  readonly refLife: Record<number, number> = {};

  constructor(readonly c: Content) {
    for (let ch = 1; ch <= 6; ch++) {
      this.refLife[ch] = this.classes.reduce((a, cl) => a + this.hs(cl, ch).LEB, 0) / this.classes.length;
    }
  }

  // ---------- Grundformeln aus den Daten ----------

  F(n: number): number {
    return 1 + this.c.balance.party.life.perExtra * (n - 1);
  }

  M(n: number): number {
    const d = this.c.balance.boss.damage;
    return d.base + d.perExtra * (n - 1);
  }

  B(ch: number): number {
    return this.c.bosses.find((b) => b.chapter === ch)!.hpBase;
  }

  hpe(lv: number): number {
    const l = this.c.balance.enemy.life;
    return l.base + l.perLevel * lv;
  }

  dpe(lv: number): number {
    const d = this.c.balance.enemy.damage;
    return d.base + d.perLevel * lv;
  }

  mit(w: number, lv: number): number {
    const m = this.c.balance.combat.mitigation;
    return w / (w + m.base + m.perLevel * lv);
  }

  itemBudget(slot: SlotId, ilvl: number, rar: RarityId): number {
    const i = this.c.balance.items;
    return i.slotWeights[slot] * (i.budget.base + i.budget.perIlvl * ilvl) * i.rarity[rar];
  }

  baseStats(cl: ClassId, L: number): Stats {
    const b = this.c.balance.stats.base;
    const hp = this.c.classById[cl].hpFactor;
    return {
      LEB: (b.leb[0] + b.leb[1] * (L - 1)) * hp,
      KRA: b.kra[0] + b.kra[1] * (L - 1),
      RUE: b.rue[0] + b.rue[1] * (L - 1),
      RES: b.res[0] + b.res[1] * (L - 1),
      TMP: b.tmp,
      KRT: b.krt,
    };
  }

  withPoints(cl: ClassId, b: Stats, pts: number): Stats {
    const share = this.c.classById[cl].shares;
    const conv = this.c.balance.stats.perPoint;
    const out = { ...b };
    for (const k of STAT_KEYS) {
      const key = k.toLowerCase() as keyof typeof share;
      out[k] = b[k] + pts * share[key] * conv[key];
    }
    return out;
  }

  hero(cl: ClassId, L: number, ilvl: number, rar: RarityId = 'selten', extra = 0): { st: Stats; tot: number } {
    const tot = SLOTS.reduce((a, s) => a + this.itemBudget(s, ilvl, rar), 0) + extra;
    return { st: this.withPoints(cl, this.baseStats(cl, L), tot), tot };
  }

  dps(cl: ClassId, st: Stats, targetMit: number): number {
    const caps = this.c.balance.stats.caps;
    const critBonus = (this.c.balance.stats.base.ksd - 100) / 100;
    return st.KRA * ASSUMPTIONS.k[cl] * (1 + st.TMP / 100) * (1 + (Math.min(st.KRT, caps.krtBuffed) / 100) * critBonus) * (1 - targetMit);
  }

  /** Heilung des Klerikers pro Sekunde (13.11): Heilendes Licht, Segensaura auf 1 Ziel, Läuterung. */
  hpsKleriker(st: Stats): number {
    const sk = (id: string) => this.c.skillById.get(id)!;
    const coef = (id: string) => sk(id).effects.find((e) => e.k === 'heal')!.coef ?? 0;
    const aura = sk('kleriker_segensaura');
    const reg = aura.effects.find((e) => e.k === 'status')!;
    const P = st.KRA;
    return (coef('kleriker_heilendes_licht') * P / sk('kleriker_heilendes_licht').cooldownS
      + (reg.value ?? 0) * P * ((reg.ms ?? 0) / 1000 / aura.cooldownS)
      + coef('kleriker_laeuterung') * P / sk('kleriker_laeuterung').cooldownS) * (1 + st.TMP / 100);
  }

  hs(cl: ClassId, ch: number): Stats {
    return this.hero(cl, 5 * ch, 5 * ch).st;
  }

  D(cl: ClassId, ch: number): number {
    return this.dps(cl, this.hs(cl, ch), ASSUMPTIONS.bossMit);
  }

  solo(cl: ClassId): number {
    return this.c.classById[cl].solo;
  }

  teamDps(comp: ClassId[], ch: number): number {
    if (comp.length === 1) return this.D(comp[0]!, ch) * this.solo(comp[0]!);
    const base = comp.reduce((a, x) => a + this.D(x, ch), 0);
    const oth = comp.filter((x) => x !== 'runenweber').reduce((a, x) => a + this.D(x, ch), 0);
    return base + (comp.includes('runenweber') ? ASSUMPTIONS.rune * oth : 0);
  }

  ttk(comp: ClassId[], ch: number, ratio = 1, elem = 1): number {
    return (this.B(ch) * this.F(comp.length)) / (this.teamDps(comp, ch) * ratio * elem);
  }

  /** Schaden pro Sekunde je Boss-Angriff (10.4) gegen einen Helden; Boss-Stufe 5 × Kapitel. */
  bossParts(st: Stats, ch: number, armorMult = 1, source: 'model' | 'data' = 'model'): { std: number; puls: number; tel: number; sig: number } {
    const r = this.refLife[ch]!;
    // Modell: einheitliches Profil aus 10.4; Daten: die Angriffe des Bosses dieses Kapitels (10.6)
    const a = source === 'model' ? ASSUMPTIONS.bossProfile : this.c.bosses.find((b) => b.chapter === ch)!.attacks;
    const lv = this.c.balance.boss.levelPerChapter * ch;
    const am = this.mit(st.RUE * armorMult, lv);
    const rm = this.mit(st.RES, lv);
    const per = (x: { pctRefHp: number; intervalMs: number }, m: number) => ((x.pctRefHp / 100) * r * (1 - m)) / (x.intervalMs / 1000);
    return { std: per(a.standard, am), puls: per(a.pulse, rm), tel: per(a.telegraph, rm), sig: per(a.signature, rm) };
  }

  stagePoints(): number {
    return this.c.balance.stage.encounterPoints.reduce((a, x) => a + x, 0);
  }

  // ---------- Fortschritt (12) ----------

  xp(L: number): number {
    const x = this.c.balance.progression.xpCurve;
    return roundTo(x.mult * L ** x.exp, -1);
  }

  goldPot(s: number): number {
    const g = this.c.balance.gold.stage;
    return g.perPoint * (g.base + g.perStage * s);
  }

  campaignXp(): number {
    const f = this.c.balance.progression.xpFactors;
    let sum = 0;
    for (let s = 1; s <= 30; s++) sum += s % 5 === 0 ? (f.bossStageEncounters + f.bossFirst) * this.xp(s) : this.xp(s);
    return sum;
  }

  campaignGold(): number {
    const g = this.c.balance.gold;
    let sum = 0;
    for (let s = 1; s <= 30; s++) {
      const G = this.goldPot(s);
      sum += s % 5 === 0 ? (G * g.bossStagePoints) / this.stagePoints() + g.bossFirst * G : G;
    }
    return sum;
  }

  /** Heldenstufe zu Beginn jeder Stage (12.4): erster Durchlauf, keine Wiederholungen. */
  levelAtStageStart(): number[] {
    const f = this.c.balance.progression.xpFactors;
    const max = this.c.balance.stats.maxLevel;
    let L = 1;
    let x = 0;
    const out: number[] = [];
    for (let s = 1; s <= 30; s++) {
      out.push(L);
      x += s % 5 === 0 ? (f.bossStageEncounters + f.bossFirst) * this.xp(s) : this.xp(s);
      while (L < max && x >= this.xp(L)) {
        x -= this.xp(L);
        L++;
      }
    }
    return out;
  }

  // ---------- Beute (12.9) ----------

  lootMc(runs: number = ASSUMPTIONS.lootRuns, seed: number = ASSUMPTIONS.lootSeed): number[] {
    const rng = new Rng(seed);
    const sl = this.c.stageLoot;
    const slotTable = sl.slotWeights;
    const rarityTable = (ch: number) => sl.rarityByChapter[String(ch) as '1'] as Partial<Record<RarityId, number>>;
    const roll = <K extends string>(d: Partial<Record<K, number>>): K => {
      const entries = Object.entries(d) as [K, number][];
      const total = entries.reduce((a, [, v]) => a + v, 0);
      const r = rng.next() * total;
      let acc = 0;
      for (const [k, v] of entries) {
        acc += v;
        if (r <= acc) return k;
      }
      return entries[entries.length - 1]![0];
    };
    const sums = [0, 0, 0, 0, 0, 0];
    for (let run = 0; run < runs; run++) {
      const best: Record<SlotId, number> = { waffe: 0, ruestung: 0, nebenhand: 0, helm: 0, handschuhe: 0, umhang: 0, stiefel: 0 };
      for (let ch = 1; ch <= 6; ch++) {
        for (let k = 1; k <= 4; k++) {
          const s = 5 * (ch - 1) + k;
          const elite = ASSUMPTIONS.eliteByStageInChapter[k - 1]!;
          const n = sl.itemsPerChest + (rng.next() < elite ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const slot = roll<SlotId>(slotTable);
            best[slot] = Math.max(best[slot], this.itemBudget(slot, s, roll<RarityId>(rarityTable(ch))));
          }
        }
        best.waffe = Math.max(best.waffe, this.itemBudget('waffe', 5 * ch, 'legendaer'));
        const slot = roll<SlotId>(slotTable);
        const rar: RarityId = rng.next() < ASSUMPTIONS.bossItemEpic ? 'episch' : 'legendaer';
        best[slot] = Math.max(best[slot], this.itemBudget(slot, 5 * ch, rar));
        const ref = SLOTS.reduce((a, x) => a + this.itemBudget(x, 5 * ch, 'selten'), 0);
        sums[ch - 1]! += SLOTS.reduce((a, x) => a + best[x], 0) / ref;
      }
    }
    return sums.map((v) => v / runs);
  }
}

/** Runden wie Python (round half to even bei exakten Hälften), auch für negative Stellen. */
export function roundTo(x: number, nd = 0): number {
  const f = 10 ** nd;
  const s = x * f;
  let r = Math.round(s);
  if (Math.abs(s - Math.trunc(s)) === 0.5) r = 2 * Math.round(s / 2);
  return r / f;
}
