// Pixel-Art-Sprites (OPEN-051): Atlanten aus `tools/sprites`, erst beim Betreten eines Runs geladen.
// Jede Figur hat ein festes Raster: Laufen, Angriff und Zaubern in vier Richtungen, Treffer nach Süden.
// Fehlt eine Datei, zeichnet die Szene weiter die Platzhalter aus `textures.ts`.
import Phaser from 'phaser';
import { BOSS_IDS, CLASS_IDS, ENEMY_IDS } from '@aethra/shared';

export const FRAME = 64;
/** Anteil der Kachelhöhe, an dem die Füße stehen (gemessen: Zeile 62 von 64). */
export const FOOT = 0.97;
/** Sichtbare Höhe einer Figur in der Kachel (gemessen: rund 50 von 64 Pixeln). */
export const FIGUR_H = 50;
const BASE = 'sprites';
const ATLAS_KEY = 'sprite-atlas';
const WALK_FPS = 10;
const ATTACK_MS = 550;
const HURT_MS = 600;

export type Dir = 'n' | 'w' | 's' | 'e';
export const DIRS: Dir[] = ['n', 'w', 's', 'e'];

interface FigurInfo {
  angriff: string;
  angriffBilder: number;
  /** Vielfaches der 64-px-Kachel; Bosse sind größer. */
  skalierung?: number;
}

export interface AtlasInfo {
  kachel: number;
  spalten: number;
  zeilen: string[];
  bilder: Record<string, number>;
  figuren: Record<string, FigurInfo>;
}

/** Alle Figuren, für die es Sprites gibt: Klassen, Gegnertypen und Bosse. */
export function spriteIds(): string[] {
  return [...CLASS_IDS, ...ENEMY_IDS, ...BOSS_IDS];
}

export function queueSprites(scene: Phaser.Scene): void {
  scene.load.json(ATLAS_KEY, `/${BASE}/atlas.json`);
  for (const id of spriteIds()) {
    scene.load.spritesheet(spriteKey(id), `/${BASE}/${id}.png`, { frameWidth: FRAME, frameHeight: FRAME });
  }
}

export function spriteKey(id: string): string {
  return `fig-${id}`;
}

export function animKey(id: string, name: string, dir: Dir): string {
  return `${id}-${name}-${dir}`;
}

/** Legt die Animationen an und liefert je geladener Figur ihre Größe (1 = 64-px-Kachel). */
export function createAnims(scene: Phaser.Scene): Map<string, number> {
  const info = scene.cache.json.get(ATLAS_KEY) as AtlasInfo | undefined;
  const fertig = new Map<string, number>();
  if (!info) return fertig;
  for (const id of spriteIds()) {
    const key = spriteKey(id);
    const figur = info.figuren[id];
    if (!figur || !scene.textures.exists(key)) continue;
    scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    const zeile = (name: string, dir: Dir) => info.zeilen.indexOf(`${name}-${dir}`);
    const anlegen = (name: string, dir: Dir, bilder: number, dauerMs: number, wiederholen: boolean) => {
      const r = zeile(name, dir);
      if (r < 0) return;
      const start = r * info.spalten;
      scene.anims.create({
        key: animKey(id, name, dir),
        frames: scene.anims.generateFrameNumbers(key, { start, end: start + bilder - 1 }),
        frameRate: wiederholen ? WALK_FPS : (bilder * 1000) / dauerMs,
        repeat: wiederholen ? -1 : 0,
      });
    };
    for (const dir of DIRS) {
      anlegen('walk', dir, info.bilder['walk'] ?? 9, 0, true);
      // „Zaubern“ nutzt dieselben Bilder wie der Angriff (OPEN-052)
      anlegen('attack', dir, figur.angriffBilder, ATTACK_MS, false);
    }
    anlegen('hurt', 's', info.bilder['hurt'] ?? 6, HURT_MS, false);
    fertig.set(id, figur.skalierung ?? 1);
  }
  return fertig;
}

/** Erstes Bild einer Zeile – die Ruhehaltung. */
export function stillFrame(scene: Phaser.Scene, dir: Dir): number {
  const info = scene.cache.json.get(ATLAS_KEY) as AtlasInfo | undefined;
  const r = info ? info.zeilen.indexOf(`walk-${dir}`) : -1;
  return r < 0 ? 0 : r * (info?.spalten ?? 13);
}

/**
 * Blickrichtung aus der Bewegung: Tiefe im Band schlägt die Seite, sonst entscheidet `face`.
 * Ohne Bewegung bleibt die zuletzt gewählte Richtung erhalten, damit die Figur nicht flackert.
 */
export function richtung(dx: number, dy: number, face: -1 | 1, vorher: Dir): Dir {
  const SCHWELLE = 0.25;
  if (Math.abs(dy) > Math.abs(dx) * 1.2 && Math.abs(dy) > SCHWELLE) return dy > 0 ? 's' : 'n';
  if (Math.abs(dx) > SCHWELLE) return dx > 0 ? 'e' : 'w';
  return vorher === 'n' || vorher === 's' ? vorher : face < 0 ? 'w' : 'e';
}
