// Alle Tabellen des Referenzmodells (13.3 bis 13.8, 12.1, 12.2, 12.5, 12.9) als Zahlen und als Textzeilen
// im Format von ref_model.py, damit sich die Ausgaben vergleichen lassen (13.11).
import { Rng } from '@aethra/shared';
import type { ClassId } from '@aethra/shared';
import type { Model} from './model';
import { ASSUMPTIONS, roundTo } from './model';

const A = ASSUMPTIONS;
const NAME: Record<ClassId, string> = {
  krieger: 'Krieger', magier: 'Magier', waldlaeufer: 'Waldläufer', schurke: 'Schurke', kleriker: 'Kleriker', runenweber: 'Runenweber',
};
const CH = [1, 2, 3, 4, 5, 6];

// ---------- Ausgabe wie Python ----------

class PyFloat {
  constructor(readonly v: number) {}
}
class PyTuple {
  constructor(readonly items: unknown[]) {}
}
const fl = (v: number) => new PyFloat(v);
const tup = (...items: unknown[]) => new PyTuple(items);

export function py(v: unknown): string {
  if (v instanceof PyFloat) return Number.isInteger(v.v) ? v.v.toFixed(1) : String(v.v);
  if (v instanceof PyTuple) return `(${v.items.map(py).join(', ')})`;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return `'${v}'`;
  if (Array.isArray(v)) return `[${v.map(py).join(', ')}]`;
  if (v instanceof Map) return `{${[...v.entries()].map(([k, x]) => `${py(k)}: ${py(x)}`).join(', ')}}`;
  return String(v);
}

/** f"{x:.nf}" wie Python. */
export function f(x: number, n: number): string {
  return roundTo(x, n).toFixed(n);
}

const R = (x: number) => roundTo(x);

export interface Report {
  lines: string[];
  soloTtk: Record<ClassId, number[]>;
  groupsWithDps: { ch: number; min: number; max: number }[];
  groupsWithoutDps: { ch: number; max: number }[];
  tank: { ch: number; ratio: number; stdRatio: number }[];
  soloPressure: Record<ClassId, number[]>;
  tankNoHealer: number[];
  /** Wie oben, aber mit den Angriffen der einzelnen Bosse (10.6) und für alle Kapitel. */
  soloPressureData: number[];
  tankNoHealerData: number[];
  encounterTank: number[];
  encounterSolo: number[];
  stageSolo: number[];
  stageGroup: number[];
  levels: number[];
  gear: number[];
  strength: number[];
  endgame: number[];
  gold: number;
  xpTo30: number;
  campaignXp: number;
}

export function buildReport(m: Model): Report {
  const cls = m.classes;
  const lines: string[] = [];
  const dict = <T>(f: (cl: ClassId) => T) => new Map(cls.map((cl) => [NAME[cl], f(cl)]));

  lines.push(`13.3 Standard-DPS: ${py(dict((cl) => CH.map((c) => R(m.D(cl, c)))))}`);
  lines.push(`13.3 Leben: ${py(dict((cl) => CH.map((c) => R(m.hs(cl, c).LEB))))}`);
  lines.push(`13.3 RefLeben: ${py(new Map(CH.map((c) => [c, R(m.refLife[c]!)])))}`);
  lines.push(`13.3 Kleriker-HPS: ${py(CH.map((c) => fl(roundTo(m.hpsKleriker(m.hs('kleriker', c)), 1))))}`);
  const dpsMean = (c: number) => A.dpsClasses.reduce((a, x) => a + m.D(x, c), 0) / A.dpsClasses.length;
  lines.push(`13.4 B berechnet: ${py(new Map(CH.map((c) => [c, fl(roundTo(150 * dpsMean(c), -2))])))}`);

  const soloTtk = Object.fromEntries(cls.map((cl) => [cl, CH.map((c) => m.ttk([cl], c))])) as Record<ClassId, number[]>;
  lines.push(`13.5 Solo: ${py(dict((cl) => [1, 3, 6].map((c) => R(m.ttk([cl], c)))))}`);
  const comps: [string, ClassId[]][] = [
    ['6 Klassen', cls],
    ['5 ohne Heiler', ['krieger', 'magier', 'waldlaeufer', 'schurke', 'runenweber']],
    ['Kr,Kl,Mag,Sch', ['krieger', 'kleriker', 'magier', 'schurke']],
    ['Mag,Wal,Sch', ['magier', 'waldlaeufer', 'schurke']],
    ['Mag,Wal', ['magier', 'waldlaeufer']],
    ['6x Magier', Array<ClassId>(6).fill('magier')],
    ['Kr,Kl', ['krieger', 'kleriker']],
    ['4 Kl+2 Kr', ['kleriker', 'kleriker', 'kleriker', 'kleriker', 'krieger', 'krieger']],
    ['3 Kl', ['kleriker', 'kleriker', 'kleriker']],
  ];
  const comp = (name: string) => comps.find(([n]) => n === name)![1];
  lines.push(`13.5 Gruppen: ${py(new Map(comps.map(([k, v]) => [k, tup(R(m.ttk(v, 3)), R(m.ttk(v, 6)))])))}`);

  // Zufallsgruppen (anderer Generator als Python: Mittelwerte ±2 s, 13.11)
  const rng = new Rng(A.randomSeed);
  for (let n = 1; n <= 6; n++) {
    const v: number[] = [];
    for (let i = 0; i < A.randomGroups; i++) v.push(m.ttk(Array.from({ length: n }, () => cls[rng.int(cls.length)]!), 3));
    v.sort((a, b) => a - b);
    const mean = v.reduce((a, x) => a + x, 0) / v.length;
    lines.push(`13.5 Zufall n=${n}: Ø ${f(mean, 0)} P10 ${f(v[A.randomGroups / 10]!, 0)} P90 ${f(v[(A.randomGroups * 9) / 10]!, 0)}`);
  }
  const allComps: ClassId[][] = [];
  const rec = (start: number, cur: ClassId[], n: number) => {
    if (cur.length === n) {
      allComps.push([...cur]);
      return;
    }
    for (let i = start; i < cls.length; i++) rec(i, [...cur, cls[i]!], n);
  };
  for (let n = 1; n <= 6; n++) rec(0, [], n);
  const hasDps = (cp: ClassId[]) => cp.some((x) => A.dpsClasses.includes(x));
  const groupsWithDps: Report['groupsWithDps'] = [];
  const groupsWithoutDps: Report['groupsWithoutDps'] = [];
  for (const c of [3, 6]) {
    const w = allComps.filter(hasDps).map((cp) => m.ttk(cp, c));
    const wo = allComps.filter((cp) => !hasDps(cp)).map((cp) => m.ttk(cp, c));
    groupsWithDps.push({ ch: c, min: Math.min(...w), max: Math.max(...w) });
    groupsWithoutDps.push({ ch: c, max: Math.max(...wo) });
    lines.push(`13.5 alle Zusammensetzungen mit Schadensklasse Kap${c}: ≤200s ${f(w.filter((t) => t <= 200).length / w.length, 2)}, max ${f(Math.max(...w), 0)}`);
  }
  for (const [nm, cp] of [['Solo Magier', ['magier']], ['Solo Krieger', ['krieger']], ['Solo Kleriker', ['kleriker']],
    ['Kr,Kl,Mag,Sch', comp('Kr,Kl,Mag,Sch')], ['6 Klassen', cls], ['Kr,Kl', comp('Kr,Kl')]] as [string, ClassId[]][]) {
    for (const c of [3, 6]) {
      const r = A.strength[c]!;
      lines.push(`13.5 realistisch ${nm} Kap${c}: Ref ${f(m.ttk(cp, c), 0)} schlecht ${f(m.ttk(cp, c, r * A.player[0], A.element[0]), 0)} `
        + `typisch ${f(m.ttk(cp, c, r * A.player[1], A.element[1]), 0)} gut ${f(m.ttk(cp, c, r * A.player[2], A.element[2]), 0)}`);
    }
  }

  // 13.6 Überleben
  const tank: Report['tank'] = [];
  for (const c of CH) {
    const p = m.bossParts(m.hs('krieger', c), c, A.kriegerArmor);
    const h = m.hpsKleriker(m.hs('kleriker', c));
    const tot = p.std + p.puls + p.tel * A.teleHit;
    tank.push({ ch: c, ratio: tot / h, stdRatio: p.std / h });
    lines.push(`13.6 Kap${c}: Tank ${f(tot, 1)}/s HPS ${f(h, 1)} Verh ${f(tot / h, 2)} nur Std ${f(p.std / h, 2)} n=3 ${f((m.M(3) * tot) / h, 2)}`);
  }
  const soloPressure = {} as Record<ClassId, number[]>;
  for (const cl of cls) {
    const row = [1, 3, 6].map((c) => {
      const st = m.hs(cl, c);
      const p = m.bossParts(st, c, cl === 'krieger' ? A.kriegerArmor : 1);
      const inc = m.M(1) * (p.std + p.puls + p.tel * A.teleHit + p.sig * A.teleHit * A.sigActive);
      return R(((inc * m.ttk([cl], c)) / st.LEB) * 100);
    });
    soloPressure[cl] = row;
    lines.push(`13.6 Solo-Druck ${NAME[cl]}: ${py(row)} %`);
  }
  const tankNoHealer: number[] = [];
  for (const [nm, cp] of [['5 ohne Heiler', comp('5 ohne Heiler')], ['Kr,Mag,Wal,Sch', ['krieger', 'magier', 'waldlaeufer', 'schurke']],
    ['Kr,Wal', ['krieger', 'waldlaeufer']]] as [string, ClassId[]][]) {
    const row = [3, 6].map((c) => {
      const st = m.hs('krieger', c);
      const p = m.bossParts(st, c, A.kriegerArmor);
      const inc = m.M(cp.length) * (p.std * A.rageOnTank + p.puls + p.tel * A.teleHitTank + p.sig * A.teleHitTank * A.sigActive) * A.tankTools;
      return R(((inc * m.ttk(cp, c)) / st.LEB) * 100);
    });
    tankNoHealer.push(...row);
    lines.push(`13.6 Tank ohne Heiler ${nm}: ${py(row)} %`);
  }
  // Dieselben Größen mit den echten Angriffswerten jedes Bosses, Kapitel 1 bis 6 (nur Prüfung, keine Modellzeile)
  const soloPressureData: number[] = [];
  const tankNoHealerData: number[] = [];
  for (const c of CH) {
    for (const cl of cls) {
      const st = m.hs(cl, c);
      const p = m.bossParts(st, c, cl === 'krieger' ? A.kriegerArmor : 1, 'data');
      const inc = m.M(1) * (p.std + p.puls + p.tel * A.teleHit + p.sig * A.teleHit * A.sigActive);
      soloPressureData.push(R(((inc * m.ttk([cl], c)) / st.LEB) * 100));
    }
    for (const cp of [comp('5 ohne Heiler'), ['krieger', 'magier', 'waldlaeufer', 'schurke'], ['krieger', 'waldlaeufer']] as ClassId[][]) {
      const st = m.hs('krieger', c);
      const p = m.bossParts(st, c, A.kriegerArmor, 'data');
      const inc = m.M(cp.length) * (p.std * A.rageOnTank + p.puls + p.tel * A.teleHitTank + p.sig * A.teleHitTank * A.sigActive) * A.tankTools;
      tankNoHealerData.push(R(((inc * m.ttk(cp, c)) / st.LEB) * 100));
    }
  }
  for (const c of [1, 3, 6]) {
    const st = m.hs('magier', c);
    const p = m.bossParts(st, c);
    const t = m.ttk(comp('5 ohne Heiler'), c);
    const inc = m.M(5) * (p.puls + p.tel * A.teleHitGroup + p.sig * A.teleHitGroup) * t;
    lines.push(`13.6 Magier-Pulse ohne Heiler Kap${c}: ${f((inc / st.LEB) * 100, 0)} %`);
  }

  // 13.7 Begegnungen und Stage-Dauer
  const encounterTank: number[] = [];
  for (const s of [4, 9, 14, 19, 24, 29]) {
    const st = m.hero('krieger', s, s).st;
    const dmg = A.tankAttackers * m.dpe(s) * (1 - m.mit(st.RUE * A.kriegerArmor, s));
    const h = m.hpsKleriker(m.hero('kleriker', s, s).st);
    encounterTank.push(dmg / h);
    lines.push(`13.7 Stage ${s}: Tank ${f(dmg, 1)}/s HP ${f(st.LEB, 0)} HPS ${f(h, 1)} Verh ${f(dmg / h, 2)}`);
  }
  const pts = m.stagePoints();
  const encounterSolo: number[] = [];
  const encounters = m.c.balance.stage.encounterPoints.length;
  for (const s of [9, 19, 29]) {
    const out = dict((cl) => {
      const st = m.hero(cl, s, s).st;
      const mm = m.mit(st.RUE * (cl === 'krieger' ? A.kriegerArmor : 1), s);
      const t = (pts * m.hpe(s)) / (m.dps(cl, st, A.trashMit) * m.solo(cl) * A.aoe[cl]);
      const v = R(((A.soloAttackers * m.dpe(s) * (1 - mm) * t) / st.LEB) * 100 / encounters);
      encounterSolo.push(v);
      return v;
    });
    lines.push(`13.7 Solo pro Begegnung Stage ${s}: ${py(out)}`);
  }
  const stageSolo: number[] = [];
  const stageGroup: number[] = [];
  for (const s of [10, 30]) {
    const solo = dict((cl) => {
      const v = R((pts * m.hpe(s)) / (m.dps(cl, m.hero(cl, s, s).st, A.trashMit) * m.solo(cl) * A.aoe[cl]));
      stageSolo.push(v);
      return v;
    });
    const tdps = cls.reduce((a, x) => a + m.dps(x, m.hero(x, s, s).st, A.trashMit) * A.aoe[x], 0) * (1 + A.rune * A.runeInEncounters);
    const g = (pts * m.hpe(s) * m.F(6)) / tdps;
    stageGroup.push(g);
    lines.push(`13.7 Kampfzeit Stage ${s}: ${py(solo)} n=6 ${f(g, 0)}`);
  }

  // 13.8 Fortschritt und Ausbau
  const strength: number[] = [];
  const bonus = m.c.balance.weapon.bonusPerLevel;
  const rarSelten = m.c.balance.items.rarity.selten;
  const wBudget = (ilvl: number) => m.c.balance.items.slotWeights.waffe * (m.c.balance.items.budget.base + m.c.balance.items.budget.perIlvl * ilvl);
  for (const c of CH) {
    const row: PyTuple[] = [];
    let tot = 0;
    let tot0 = 0;
    for (const cl of ['krieger', 'magier', 'kleriker'] as ClassId[]) {
      const h0 = m.hero(cl, 5 * c, 5 * c);
      tot0 = h0.tot;
      const wref = wBudget(5 * c) * rarSelten;
      tot = h0.tot * A.gear[c - 1]! + wref * bonus * (A.weaponLevel[c - 1]! - 1) + A.gemPoints[c - 1]! + A.artifactPoints[c - 1]!;
      const st = m.withPoints(cl, m.baseStats(cl, 5 * c), tot);
      const r = m.dps(cl, st, A.bossMit) / m.dps(cl, h0.st, A.bossMit);
      strength.push(r * (1 + A.enchant[c - 1]!));
      row.push(tup(fl(roundTo(r, 2)), fl(roundTo(r * (1 + A.enchant[c - 1]!), 2))));
    }
    lines.push(`13.8 Kap${c} Punkte/Ref ${f(tot / tot0, 2)} Krieger/Magier/Kleriker ${py(row)}`);
  }
  const endgame: number[] = [];
  const gemMax = m.c.gems.slotUnlockLevels.length * m.c.gems.tierPoints[m.c.gems.tierPoints.length - 1]!;
  const artMax = 3 * Math.max(...m.c.artifacts.map((a) => a.rankPoints[a.rankPoints.length - 1]!));
  const rar = m.c.balance.items.rarity;
  const caps = m.c.balance.stats.caps;
  for (const cl of ['magier', 'krieger'] as ClassId[]) {
    for (const [nm, il, r, ele, kra] of [['A', 30, 'episch', 0, false], ['B', 34, 'legendaer', 0.05, false], ['B Kraft', 34, 'legendaer', 0.05, true]] as const) {
      const b = m.baseStats(cl, 30);
      let g = (['waffe', 'ruestung', 'nebenhand', 'helm', 'handschuhe', 'umhang', 'stiefel'] as const).reduce((a, s) => a + m.itemBudget(s, il, r), 0)
        + wBudget(il) * rar.legendaer * A.bossWeaponShare;
      if (r === 'episch') g += wBudget(il) * (rar.legendaer - rar.episch);
      let st;
      if (kra) {
        st = m.withPoints(cl, b, g + artMax);
        st.KRA += gemMax * m.c.balance.stats.perPoint.kra;
      } else {
        st = m.withPoints(cl, b, g + gemMax + artMax);
      }
      st.TMP = Math.min(st.TMP, caps.tmp);
      st.KRT = Math.min(st.KRT, caps.krt);
      const v = (m.dps(cl, st, A.bossMit) * A.endgameEnchant * (1 + ele)) / m.D(cl, 6);
      endgame.push(v);
      lines.push(`13.8 Endspiel ${NAME[cl]} ${nm}: ${f(v, 2)}`);
    }
  }

  // 12 Fortschritt
  let xpTo30 = 0;
  for (let L = 1; L < m.c.balance.stats.maxLevel; L++) xpTo30 += m.xp(L);
  lines.push(`12.1 XP bis 30: ${xpTo30}`);
  const campaignXp = m.campaignXp();
  lines.push(`12.2 Kampagne XP: ${R(campaignXp)}`);
  const gold = m.campaignGold();
  lines.push(`12.5 Kampagne Gold: ${R(gold)}`);
  const gear = m.lootMc();
  lines.push(`12.9 Ausrüstung/Referenz: ${py(gear.map((x) => fl(roundTo(x, 2))))}`);

  return {
    lines, soloTtk, groupsWithDps, groupsWithoutDps, tank, soloPressure, tankNoHealer, soloPressureData, tankNoHealerData, encounterTank, encounterSolo, stageSolo,
    stageGroup, levels: m.levelAtStageStart(), gear, strength, endgame, gold, xpTo30, campaignXp,
  };
}
