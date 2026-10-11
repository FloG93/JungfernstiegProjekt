// Eine Handlung ausführen (ENTWURF-rundenkampf.md, Abschnitt 1.3) und die Wirkungen einer Fähigkeit anwenden.
import type { StatusId } from '../content/ids';
import type { SkillDef } from '../content/schemas';
import { handler } from './handler';
import { statusSetzen } from './status';
import { melde } from './typen';
import type { Aktion, Figur, Kampf } from './typen';
import { abklingRunden, rundenAusMs, zielbildDerWirkung } from './umrechnung';
import { kannHandeln, werte } from './werte';
import { energieGeben, gegnerTrifft, heilen, heldTrifft, schildGeben } from './wirkung';
import { istErreichbar, zieleDerWirkung } from './ziele';
import type { Wahl } from './ziele';

const PROZENT = 100;

type Wirkung = SkillDef['effects'][number];

function alsParams(w: Wirkung): Record<string, number | string | boolean> {
  return (('params' in w ? w.params : {}) ?? {}) as Record<string, number | string | boolean>;
}

/** Zielt diese Fähigkeit auf eine Gegnerreihe statt auf eine einzelne Figur? */
export function faehigkeitBereit(k: Kampf, f: Figur, s: SkillDef): boolean {
  if (s.slot === 'passive') return false;
  if (s.slot === 'ult') return f.energie >= k.content.runden.energie.max;
  return (f.abkling[s.id] ?? 0) <= 0;
}

/** Fähigkeiten, die die Figur gerade einsetzen könnte. */
export function bereiteFaehigkeiten(k: Kampf, f: Figur): SkillDef[] {
  if (!f.klasse) return [];
  return k.content.classById[f.klasse].skills
    .map((id) => k.content.skillById.get(id))
    .filter((s): s is SkillDef => !!s && s.slot !== 'passive' && faehigkeitBereit(k, f, s));
}

function wirkungAnwenden(k: Kampf, von: Figur, s: SkillDef, w: Wirkung, wahl: Wahl): Figur[] {
  const anzahl = 'count' in w && typeof w.count === 'number' ? w.count : 1;
  const bild = zielbildDerWirkung(k.content, s, w as { to?: string; radiusPx?: number });
  const ziele = zieleDerWirkung(k, von, bild, wahl, anzahl);
  switch (w.k) {
    case 'damage': {
      const haupt = ziele[0];
      const splash = 'splashPct' in w && typeof w.splashPct === 'number' ? w.splashPct : 0;
      if (splash > 0 && haupt) {
        heldTrifft(k, von, haupt, w.coef, von.element);
        for (const z of zieleDerWirkung(k, von, 'zielUndReihe', { zielId: haupt.id })) {
          if (z.id !== haupt.id) heldTrifft(k, von, z, (w.coef * splash) / PROZENT, von.element);
        }
        break;
      }
      for (const z of ziele) heldTrifft(k, von, z, w.coef, von.element);
      break;
    }
    case 'heal': {
      const st = werte(k, von);
      for (const z of ziele) {
        const menge = 'pctMaxHp' in w && typeof w.pctMaxHp === 'number'
          ? (z.maxLp * w.pctMaxHp) / PROZENT
          : ('coef' in w && typeof w.coef === 'number' ? w.coef : 0) * st.kra;
        heilen(k, von, z, menge);
      }
      break;
    }
    case 'shield': {
      const basis = w.pctMaxHpOf === 'caster' ? von.maxLp : 0;
      for (const z of ziele) {
        schildGeben(k, z, ((basis || z.maxLp) * w.pct) / PROZENT, rundenDerWirkung(k, w.ms));
      }
      break;
    }
    case 'buff': {
      const mods = [{ stat: w.stat, ...(w.mult !== undefined ? { mult: w.mult } : {}), ...(w.add !== undefined ? { add: w.add } : {}) }];
      for (const z of ziele) {
        statusSetzen(k, z, {
          id: (w.display ?? 'schild') as StatusId, ms: w.ms, mods, quelleId: von.id,
          ...(w.display ? { anzeige: w.display } : {}),
        });
      }
      break;
    }
    case 'status': {
      for (const z of ziele) {
        // Bosse sind gegen harte Kontrolle immun; die Daten nennen dafür einen Ersatzeffekt (10.3)
        const roher = 'bossReplace' in w && w.bossReplace ? w.bossReplace : undefined;
        const ersatz = z.art === 'boss' && roher?.k === 'status' ? roher : undefined;
        const roh: { id: string; ms: number; stacks?: number; value?: number } = ersatz ?? {
          id: w.id, ms: w.ms,
          ...(typeof w.stacks === 'number' ? { stacks: w.stacks } : {}),
          ...(typeof w.value === 'number' ? { value: w.value } : {}),
        };
        statusSetzen(k, z, {
          id: roh.id as StatusId, ms: roh.ms, quelleId: von.id,
          ...(typeof roh.stacks === 'number' ? { stapel: roh.stacks } : {}),
          ...(typeof roh.value === 'number' ? { wert: roh.value } : {}),
        });
      }
      break;
    }
    case 'handler': {
      const fn = handler(w.id);
      if (fn) fn({ k, von, ziele, wahl, params: alsParams(w) });
      break;
    }
    default:
      break;
  }
  return ziele;
}

function rundenDerWirkung(k: Kampf, ms: number): number {
  return rundenAusMs(k.content, ms);
}

/** Passive Fähigkeiten gelten dauerhaft und werden zu Kampfbeginn gesetzt. */
export function passiveSetzen(k: Kampf, f: Figur): void {
  if (!f.klasse) return;
  for (const id of k.content.classById[f.klasse].skills) {
    const s = k.content.skillById.get(id);
    if (!s || s.slot !== 'passive') continue;
    for (const w of s.effects) {
      if (w.k !== 'buff') continue;
      const mods = [{ stat: w.stat, ...(w.mult !== undefined ? { mult: w.mult } : {}), ...(w.add !== undefined ? { add: w.add } : {}) }];
      statusSetzen(k, f, { id: (w.display ?? 'schild') as StatusId, ms: 0, mods, anzeige: w.display ?? s.id });
    }
  }
}

/** Führt die gewählte Handlung aus. Ungültige Wahl wird gemeldet und verfällt. */
export function aktionAusfuehren(k: Kampf, f: Figur, a: Aktion): void {
  if (f.tot) {
    melde(k, { e: 'verfehlt', von: f.id, grund: 'tot' });
    return;
  }
  if (!kannHandeln(k, f)) {
    melde(k, { e: 'verfehlt', von: f.id, grund: 'blockiert' });
    return;
  }
  f.verteidigt = false;
  switch (a.k) {
    case 'verteidigen': {
      f.verteidigt = true;
      melde(k, { e: 'aktion', von: f.id, art: 'verteidigen', ziele: [] });
      for (const g of k.figuren) {
        if (g.seite !== 'gegner' || g.tot) continue;
        const bisher = g.bedrohung.get(f.id) ?? 0;
        g.bedrohung.set(f.id, bisher * k.content.runden.verteidigen.bedrohungMult);
      }
      break;
    }
    case 'reihe': {
      f.reihe = f.reihe === 'vorn' ? 'hinten' : 'vorn';
      melde(k, { e: 'aktion', von: f.id, art: 'reihe', ziele: [] });
      melde(k, { e: 'reihe', id: f.id, reihe: f.reihe });
      break;
    }
    case 'trank': {
      if (f.traenke <= 0 || f.trankAbkling > 0) {
        melde(k, { e: 'verfehlt', von: f.id, grund: 'nichtBereit' });
        return;
      }
      f.traenke -= 1;
      f.trankAbkling = Math.max(1, Math.round(k.content.balance.combat.potion.cooldownS / k.content.runden.rundeSekunden));
      melde(k, { e: 'aktion', von: f.id, art: 'trank', ziele: [f.id] });
      heilen(k, f, f, (f.maxLp * k.content.balance.combat.potion.pct) / PROZENT);
      break;
    }
    case 'angriff': {
      const ziel = k.figuren.find((x) => x.id === a.ziel && !x.tot);
      if (!ziel || !istErreichbar(k, f, ziel)) {
        melde(k, { e: 'verfehlt', von: f.id, grund: 'keinZiel' });
        return;
      }
      melde(k, { e: 'aktion', von: f.id, art: 'angriff', ziele: [ziel.id] });
      if (f.seite === 'gegner') {
        f.zielId = ziel.id;
        gegnerTrifft(k, f, ziel);
      } else {
        const basis = grundfaehigkeit(k, f);
        if (basis) for (const w of basis.effects) wirkungAnwenden(k, f, basis, w, { zielId: ziel.id });
        else heldTrifft(k, f, ziel, 1, f.element);
      }
      break;
    }
    case 'faehigkeit': {
      const s = k.content.skillById.get(a.id);
      if (!s || !f.klasse || !k.content.classById[f.klasse].skills.includes(a.id) || !faehigkeitBereit(k, f, s)) {
        melde(k, { e: 'verfehlt', von: f.id, grund: 'nichtBereit' });
        return;
      }
      const wahl: Wahl = { ...(a.ziel !== undefined ? { zielId: a.ziel } : {}), ...(a.reihe ? { reihe: a.reihe } : {}) };
      const getroffen = new Set<number>();
      for (const w of s.effects) for (const z of wirkungAnwenden(k, f, s, w, wahl)) getroffen.add(z.id);
      melde(k, { e: 'aktion', von: f.id, art: 'faehigkeit', id: s.id, ziele: [...getroffen] });
      if (s.slot === 'ult') {
        f.energie = 0;
        melde(k, { e: 'energie', id: f.id, wert: 0 });
      } else {
        f.abkling[s.id] = abklingRunden(k.content, s);
      }
      break;
    }
    default:
      break;
  }
  if (f.seite === 'held' && a.k !== 'faehigkeit') energieGeben(k, f, k.content.runden.energie.jeAktion);
  else if (f.seite === 'held' && a.k === 'faehigkeit' && k.content.skillById.get(a.id)?.slot !== 'ult') {
    energieGeben(k, f, k.content.runden.energie.jeAktion);
  }
}

export function grundfaehigkeit(k: Kampf, f: Figur): SkillDef | undefined {
  if (!f.klasse) return undefined;
  return k.content.classById[f.klasse].skills
    .map((id) => k.content.skillById.get(id))
    .find((s): s is SkillDef => !!s && s.slot === 'auto');
}
