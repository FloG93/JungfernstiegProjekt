// Gemeinsame Hilfen für Tests (nur Node).
import type { Content } from './content/loader';
import { loadContentFromDir } from './node';

let cached: Content | undefined;

/** Lädt die echten Inhaltsdateien einmal je Testprozess. */
export function testContent(): Content {
  cached ??= loadContentFromDir();
  return cached;
}
