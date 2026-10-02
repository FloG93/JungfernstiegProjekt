// Inhalte vom Server (15.2): ein Bündel aller Dateien, geprüft mit demselben Loader wie auf dem Server.
import { loadContent } from '@aethra/shared';
import type { Content } from '@aethra/shared';
import { setTexts } from './i18n';

let current: Content | null = null;
let currentHash = '';

export function content(): Content {
  if (!current) throw new Error('Inhalte noch nicht geladen');
  return current;
}

export function contentHash(): string {
  return currentHash;
}

export async function loadGameContent(): Promise<Content> {
  const r = await fetch('/content/bundle.json', { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Inhalte nicht erreichbar (${r.status})`);
  const j = (await r.json()) as { hash: string; files: Record<string, unknown> };
  current = loadContent(j.files);
  currentHash = j.hash;
  setTexts(current);
  return current;
}
