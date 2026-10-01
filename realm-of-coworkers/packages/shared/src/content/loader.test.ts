import { describe, expect, it } from 'vitest';
import { DEFAULT_CONTENT_DIR, readContentFiles } from '../node';
import { ContentError, loadContent } from './loader';
import type { RawContent } from './loader';

const clone = (raw: RawContent): RawContent => JSON.parse(JSON.stringify(raw)) as RawContent;

describe('Content-Loader (15.5)', () => {
  const { raw, hash } = readContentFiles(DEFAULT_CONTENT_DIR);

  it('lädt alle mitgelieferten Dateien ohne Fehler', () => {
    const c = loadContent(raw);
    expect(c.classes).toHaveLength(6);
    expect(c.skills).toHaveLength(36);
    expect(c.statuses).toHaveLength(27);
    expect(c.elements).toHaveLength(7);
    expect(c.enemies).toHaveLength(9);
    expect(c.bosses).toHaveLength(6);
    expect(c.stages).toHaveLength(30);
    expect(c.artifacts).toHaveLength(18);
    expect(c.story).toHaveLength(6);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  const broken: [string, (r: RawContent) => void, RegExp][] = [
    ['Palette ergibt nicht 100', (r) => {
      (r['levels/palette.json'] as Record<string, Record<string, number>>)['1']!['scherge'] = 39;
    }, /palette\.json: Kapitel 1/],
    ['fehlende Datei', (r) => {
      delete r['bosses.json'];
    }, /bosses\.json: Datei fehlt/],
    ['unbekannte Fähigkeit', (r) => {
      (r['classes.json'] as { skills: string[] }[])[0]!.skills[1] = 'krieger_gibtsnicht';
    }, /unbekannte Fähigkeit/],
    ['Artefakt ändert fremde Klasse', (r) => {
      const a = (r['artifacts.json'] as { effect: { params: Record<string, unknown> } }[])[1]!;
      a.effect.params['path'] = 'skill:magier_elementarkugel.cooldownS';
    }, /fremden Klasse/],
    ['Anteile ergeben nicht 1', (r) => {
      (r['classes.json'] as { shares: Record<string, number> }[])[2]!.shares['kra'] = 0.5;
    }, /Anteile von waldlaeufer/],
    ['falscher Typ', (r) => {
      (r['balance.json'] as { stats: { maxLevel: unknown } }).stats.maxLevel = 'dreißig';
    }, /balance\.json: stats\.maxLevel/],
    ['Boss-Stage verweist auf falschen Boss', (r) => {
      (r['levels/stage-10.json'] as { boss: string }).boss = 'nyxhara';
    }, /stage-10\.json: Boss nyxhara/],
    ['Beutetabelle ergibt nicht 100', (r) => {
      (r['loot/boss-drops.json'] as { first: { item: Record<string, number> } }).first.item['episch'] = 80;
    }, /boss-drops\.json: Seltenheiten/],
  ];

  for (const [name, mutate, pattern] of broken) {
    it(`lehnt eine fehlerhafte Datei ab: ${name}`, () => {
      const r = clone(raw);
      mutate(r);
      let err: unknown;
      try {
        loadContent(r);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(ContentError);
      expect((err as ContentError).message).toMatch(pattern);
    });
  }
});
