// Node-spezifische Hilfen (Dateizugriff), nicht für den Client.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentFileList, loadContent } from './content/loader';
import type { Content, RawContent } from './content/loader';

/** packages/content relativ zu diesem Paket (Entwicklung und Tests). */
export const DEFAULT_CONTENT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../content');

export interface RawContentFiles {
  raw: RawContent;
  /** Unveränderter Dateiinhalt je Datei, für die Auslieferung an den Client (15.2). */
  text: Record<string, string>;
  /** Hash über alle Dateien (15.6). */
  hash: string;
}

export function readContentFiles(dir: string = DEFAULT_CONTENT_DIR): RawContentFiles {
  const raw: RawContent = {};
  const text: Record<string, string> = {};
  const h = createHash('sha256');
  for (const file of contentFileList()) {
    let t: string;
    try {
      t = readFileSync(join(dir, file), 'utf8');
    } catch {
      continue; // fehlende Dateien meldet der Loader
    }
    text[file] = t;
    h.update(file).update('\0').update(t).update('\0');
    try {
      raw[file] = JSON.parse(t);
    } catch (e) {
      raw[file] = { __parseError: String(e) };
    }
  }
  return { raw, text, hash: h.digest('hex').slice(0, 16) };
}

export function loadContentFromDir(dir: string = DEFAULT_CONTENT_DIR): Content {
  return loadContent(readContentFiles(dir).raw);
}
