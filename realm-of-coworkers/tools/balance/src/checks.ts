// Akzeptanzgrenzen für pnpm balance (13.9). Jede Prüfung nennt Wert und Grenze.
import type { ClassId } from '@aethra/shared';
import type { Report } from './report';
import { f } from './report';

export interface Check {
  name: string;
  value: string;
  limit: string;
  ok: boolean;
}

const LIMITS = {
  soloTtk: [130, 210],
  soloSpread: 1.45,
  groupsWithDps: [110, 290],
  groupsWithoutDps: 430,
  tankStd: 0.45,
  tankTotal: 0.55,
  soloPressure: 230,
  tankNoHealer: 250,
  encounterTank: 0.35,
  encounterSolo: 80,
  stageSolo: [90, 300],
  stageGroup: 200,
  levelDeviation: 1,
  gear: [0.7, 1.1],
  strength: [0.9, 1.7],
  endgame: 3.0,
  gold: [25_000, 32_000],
} as const;

const range = (xs: number[]) => [Math.min(...xs), Math.max(...xs)] as const;

export function runChecks(r: Report): Check[] {
  const out: Check[] = [];
  const add = (name: string, value: string, limit: string, ok: boolean) => out.push({ name, value, limit, ok });

  const solo = Object.values(r.soloTtk).flat();
  const [smin, smax] = range(solo);
  add('Solo-Kampfdauer je Klasse und Kapitel', `${f(smin, 0)} bis ${f(smax, 0)} s`, '130 bis 210 s', smin >= LIMITS.soloTtk[0] && smax <= LIMITS.soloTtk[1]);
  const spreads = [0, 1, 2, 3, 4, 5].map((i) => {
    const v = (Object.keys(r.soloTtk) as ClassId[]).map((cl) => r.soloTtk[cl][i]!);
    return Math.max(...v) / Math.min(...v);
  });
  add('Spanne schnellste zu langsamste Solo-Klasse', f(Math.max(...spreads), 2), 'höchstens 1,45', Math.max(...spreads) <= LIMITS.soloSpread);
  const gmin = Math.min(...r.groupsWithDps.map((g) => g.min));
  const gmax = Math.max(...r.groupsWithDps.map((g) => g.max));
  add('Kampfdauer Gruppen mit Schadensklasse', `${f(gmin, 0)} bis ${f(gmax, 0)} s`, '110 bis 290 s', gmin >= LIMITS.groupsWithDps[0] && gmax <= LIMITS.groupsWithDps[1]);
  const wo = Math.max(...r.groupsWithoutDps.map((g) => g.max));
  add('Kampfdauer Gruppen ohne Schadensklasse', `${f(wo, 0)} s`, 'höchstens 430 s', wo <= LIMITS.groupsWithoutDps);
  const tStd = Math.max(...r.tank.map((t) => t.stdRatio));
  add('Tank-Schaden zu Heilung, Standardangriff, n = 6', f(tStd, 2), 'höchstens 0,45', tStd <= LIMITS.tankStd);
  const tTot = Math.max(...r.tank.map((t) => t.ratio));
  add('Tank-Schaden zu Heilung, gesamt, n = 6', f(tTot, 2), 'höchstens 0,55', tTot <= LIMITS.tankTotal);
  const sp = Math.max(...Object.values(r.soloPressure).flat(), ...r.soloPressureData);
  add('Solo-Druck durch Boss (Modell und Bossdaten, Kapitel 1 bis 6)', `${sp} %`, 'höchstens 230 %', sp <= LIMITS.soloPressure);
  const tn = Math.max(...r.tankNoHealer, ...r.tankNoHealerData);
  add('Tank-Druck ohne Heiler (Modell und Bossdaten)', `${tn} %`, 'höchstens 250 %', tn <= LIMITS.tankNoHealer);
  const et = Math.max(...r.encounterTank);
  add('Tank-Schaden zu Heilung, normale Begegnung', f(et, 2), 'höchstens 0,35', et <= LIMITS.encounterTank);
  const es = Math.max(...r.encounterSolo);
  add('Schaden pro Begegnung solo', `${es} %`, 'höchstens 80 %', es <= LIMITS.encounterSolo);
  const [ssmin, ssmax] = range(r.stageSolo);
  const sg = Math.max(...r.stageGroup);
  add('Kampfzeit pro Stage solo und n = 6', `${ssmin} bis ${ssmax} s, n = 6: ${f(sg, 0)} s`, '90 bis 300 s, n = 6 höchstens 200 s',
    ssmin >= LIMITS.stageSolo[0] && ssmax <= LIMITS.stageSolo[1] && sg <= LIMITS.stageGroup);
  const dev = Math.max(...r.levels.map((l, i) => Math.abs(l - (i + 1))));
  add('Heldenstufe zu Beginn der Stage s', `größte Abweichung ${dev}`, 's ± 1', dev <= LIMITS.levelDeviation);
  const [gearMin, gearMax] = range(r.gear);
  add('Ausrüstung gegenüber Referenz (12.9)', `${f(gearMin, 2)} bis ${f(gearMax, 2)}`, '0,7 bis 1,1', gearMin >= LIMITS.gear[0] && gearMax <= LIMITS.gear[1]);
  const [stMin, stMax] = range(r.strength);
  add('Gesamtstärke am Kapitelende (13.8)', `${f(stMin, 2)} bis ${f(stMax, 2)}`, '0,9 bis 1,7', stMin >= LIMITS.strength[0] && stMax <= LIMITS.strength[1]);
  const eg = Math.max(...r.endgame);
  add('Vollausbau', f(eg, 2), 'höchstens 3,0', eg <= LIMITS.endgame);
  add('Gold der Kampagne', `${Math.round(r.gold)}`, '25.000 bis 32.000', r.gold >= LIMITS.gold[0] && r.gold <= LIMITS.gold[1]);
  return out;
}
