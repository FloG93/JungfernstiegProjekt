import { describe, expect, it } from 'vitest';
import { createItem, inflectPrefix, statsToPoints } from './items';
import { Rng } from './rng';
import { testContent } from './testing';

const c = testContent();

describe('Gegenstände (8.3, 8.5)', () => {
  it('beugt Präfixe nach dem Geschlecht', () => {
    expect(inflectPrefix('Zerschlissener', 'm')).toBe('Zerschlissener');
    expect(inflectPrefix('Zerschlissener', 'f')).toBe('Zerschlissene');
    expect(inflectPrefix('Zerschlissener', 'n')).toBe('Zerschlissenes');
    expect(inflectPrefix('Uralter', 'pl')).toBe('Uralte');
  });

  it('erzeugt Namen aus Präfix, Typ und Suffix', () => {
    const it = createItem(c, new Rng(1), { classId: 'waldlaeufer', slot: 'helm', ilvl: 5, rarity: 'gewoehnlich' });
    expect(it.name).toMatch(/^\S+e Lederkappe (der|des) /);
    expect(it.element).toBeNull();
    expect(statsToPoints(c, it.stats)).toBeCloseTo(it.budget, 9);
  });

  it('erzeugt die legendäre Bosswaffe', () => {
    const it = createItem(c, new Rng(2), { classId: 'krieger', slot: 'helm', ilvl: 5, rarity: 'selten', bossWeapon: 'ignarch' });
    expect(it.name).toBe('Langschwert des Glutkönigs');
    expect(it.slot).toBe('waffe');
    expect(it.rarity).toBe('legendaer');
    expect(it.element).toBe('feuer');
    expect(it.ele).toBe(1);
    expect(it.effectId).toBe('ignarch');
  });

  it('begrenzt die Item-Stufe auf 34', () => {
    const it = createItem(c, new Rng(3), { classId: 'magier', slot: 'waffe', ilvl: 40, rarity: 'episch', element: 'eis' });
    expect(it.ilvl).toBe(34);
    expect(it.element).toBe('eis');
  });
});
