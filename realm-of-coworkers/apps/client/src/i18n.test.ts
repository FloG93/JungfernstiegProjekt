// Alle sichtbaren Texte liegen in content/i18n/de.json (14.10): jeder feste Schlüssel im Client muss dort stehen.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = new URL('.', import.meta.url).pathname;
const de = JSON.parse(readFileSync(join(here, '../../../packages/content/i18n/de.json'), 'utf8')) as Record<string, Record<string, string>>;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts') ? [p] : [];
  });
}

describe('Texte', () => {
  it('jeder t(\'gruppe.schluessel\') im Client existiert in de.json', () => {
    const missing: string[] = [];
    for (const f of files(here)) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z]+)\.([a-zA-Z0-9_]+)'/g)) {
        if (!de[m[1]!]?.[m[2]!]) missing.push(`${m[1]}.${m[2]} (${f.slice(here.length)})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('dynamische Gruppen sind vollständig (Abbrüche, Schnellnachrichten)', () => {
    for (const r of ['camp', 'empty', 'pause', 'server', 'left']) expect(de['hud']?.[`closed_${r}`]).toBeTruthy();
    for (let i = 1; i <= 5; i++) expect(de['chat']?.[`quick${i}`]).toBeTruthy();
  });
});
