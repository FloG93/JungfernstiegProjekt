// Platzhalter-Grafik (14.8, 16): einfarbige Figuren mit Klassen- bzw. Typ-Symbol, zur Laufzeit gezeichnet.
// Texturen entstehen bei Bedarf und bleiben für die Spielinstanz erhalten.
import Phaser from 'phaser';
import type { ClassId } from '@aethra/shared';
import { CHAPTER_THEME, CLASS_COLOR, shade } from './palette';

type G = Phaser.GameObjects.Graphics;

const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

export const HERO_W = 44;
export const HERO_H = 64;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
  return key;
}

function eyes(g: G, cx: number, cy: number, gap: number, r: number, color = 0xffffff): void {
  g.fillStyle(color, 1);
  g.fillCircle(cx - gap, cy, r);
  g.fillCircle(cx + gap, cy, r);
  g.fillStyle(0x111111, 1);
  g.fillCircle(cx - gap + 0.6, cy + 0.4, r * 0.5);
  g.fillCircle(cx + gap + 0.6, cy + 0.4, r * 0.5);
}

function star(g: G, cx: number, cy: number, r: number, points = 5): void {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(v(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
  }
  g.fillPoints(pts, true);
}

/** Klassen-Symbol auf der Brust (14.8: Platzhalter mit Klassen-Symbol). */
function classSymbol(g: G, cls: ClassId, cx: number, cy: number): void {
  g.fillStyle(0xffffff, 0.92);
  g.lineStyle(2, 0xffffff, 0.92);
  switch (cls) {
    case 'krieger':
      g.fillPoints([v(cx - 7, cy - 7), v(cx + 7, cy - 7), v(cx + 7, cy + 1), v(cx, cy + 8), v(cx - 7, cy + 1)], true);
      break;
    case 'magier':
      star(g, cx, cy, 8);
      break;
    case 'waldlaeufer':
      g.lineBetween(cx - 7, cy + 6, cx + 6, cy - 7);
      g.fillTriangle(cx + 8, cy - 9, cx + 1, cy - 7, cx + 6, cy - 2);
      break;
    case 'schurke':
      g.fillPoints([v(cx, cy - 9), v(cx + 3, cy + 3), v(cx, cy + 9), v(cx - 3, cy + 3)], true);
      break;
    case 'kleriker':
      g.fillRect(cx - 2, cy - 8, 4, 16);
      g.fillRect(cx - 7, cy - 3, 14, 4);
      break;
    case 'runenweber':
      g.strokePoints([v(cx, cy - 8), v(cx + 7, cy), v(cx, cy + 8), v(cx - 7, cy)], true, true);
      g.lineBetween(cx, cy - 8, cx, cy + 8);
      break;
  }
}

/** Held: Körperform (4) und Farbpalette (6) aus dem Aussehen (4.1). */
export function heroTexture(scene: Phaser.Scene, cls: ClassId, body: number, palette: number): string {
  const key = `hero-${cls}-${body % 4}-${palette % 6}`;
  return make(scene, key, HERO_W, HERO_H, (g) => {
    const base = shade(CLASS_COLOR[cls], (palette % 6 - 2.5) * 0.08);
    const dark = shade(base, -0.45);
    const wide = [0, 4, -3, 2][body % 4]!;
    g.fillStyle(dark, 1);
    g.fillRoundedRect(8 - wide / 2, 22, 28 + wide, 36, 8);
    g.fillStyle(base, 1);
    g.fillRoundedRect(10 - wide / 2, 24, 24 + wide, 32, 7);
    g.fillStyle(0xf0d2b0, 1);
    g.fillCircle(22, 15, 10);
    g.fillStyle(dark, 1);
    g.fillRect(12, 4, 20, 6);
    eyes(g, 22, 15, 4, 1.8);
    classSymbol(g, cls, 22, 39);
    g.fillStyle(dark, 1);
    g.fillRect(14, 56, 6, 7);
    g.fillRect(25, 56, 6, 7);
  });
}

const ENEMY_SIZE: Record<string, [number, number]> = {
  scherge: [40, 44], hetzer: [42, 38], schuetze: [38, 46], schwarmling: [28, 26], brecher: [58, 58], priester: [38, 54],
  kultist: [38, 52], bomber: [36, 36], waechter: [52, 56], dummy: [40, 56],
};

export function enemySize(type: string): [number, number] {
  return ENEMY_SIZE[type] ?? [40, 44];
}

/** Gegner: 9 Typen (9.3) als Formen in der Farbe des Kapitels; Elite mit goldenem Rahmen. */
export function enemyTexture(scene: Phaser.Scene, type: string, chapter: number, elite: boolean): string {
  const key = `enemy-${type}-${chapter}-${elite ? 'e' : 'n'}`;
  const [w, h] = enemySize(type);
  return make(scene, key, w + 8, h + 8, (g) => {
    const th = CHAPTER_THEME[chapter] ?? CHAPTER_THEME[1]!;
    const c = shade(th.accent, -0.15);
    const d = shade(th.accent, -0.6);
    const ox = 4;
    const oy = 4;
    if (elite) {
      g.lineStyle(3, 0xffc94a, 1);
      g.strokeRoundedRect(1, 1, w + 6, h + 6, 8);
    }
    g.fillStyle(d, 1);
    switch (type) {
      case 'hetzer':
        g.fillTriangle(ox, oy + h, ox + w, oy + h * 0.55, ox + w * 0.3, oy);
        g.fillStyle(c, 1);
        g.fillTriangle(ox + 4, oy + h - 3, ox + w - 4, oy + h * 0.55, ox + w * 0.32, oy + 6);
        eyes(g, ox + w * 0.42, oy + h * 0.42, 4, 2);
        break;
      case 'schuetze':
        g.fillRoundedRect(ox + 4, oy + 8, w - 12, h - 8, 6);
        g.fillStyle(c, 1);
        g.fillRoundedRect(ox + 6, oy + 10, w - 16, h - 12, 5);
        g.lineStyle(2, 0xd8c8a0, 1);
        g.beginPath();
        g.arc(ox + w - 6, oy + h / 2, h * 0.38, -1.2, 1.2, false);
        g.strokePath();
        eyes(g, ox + w / 2 - 2, oy + 20, 4, 2);
        break;
      case 'schwarmling':
        g.fillCircle(ox + w / 2, oy + h / 2, Math.min(w, h) / 2);
        g.fillStyle(c, 1);
        g.fillCircle(ox + w / 2, oy + h / 2, Math.min(w, h) / 2 - 2);
        eyes(g, ox + w / 2, oy + h / 2 - 2, 4, 2);
        break;
      case 'brecher':
        g.fillRoundedRect(ox, oy + 6, w, h - 6, 6);
        g.fillStyle(c, 1);
        g.fillRoundedRect(ox + 3, oy + 9, w - 6, h - 12, 5);
        g.fillStyle(0xe8e0d0, 1);
        g.fillTriangle(ox + 4, oy + 10, ox + 10, oy + 10, ox + 2, oy);
        g.fillTriangle(ox + w - 4, oy + 10, ox + w - 10, oy + 10, ox + w - 2, oy);
        eyes(g, ox + w / 2, oy + 22, 7, 2.6, 0xffe066);
        break;
      case 'priester':
        g.fillTriangle(ox + w / 2, oy, ox, oy + h, ox + w, oy + h);
        g.fillStyle(c, 1);
        g.fillTriangle(ox + w / 2, oy + 5, ox + 4, oy + h - 2, ox + w - 4, oy + h - 2);
        g.fillStyle(0xffffff, 0.9);
        g.fillRect(ox + w / 2 - 1.5, oy + h * 0.5, 3, 12);
        g.fillRect(ox + w / 2 - 5, oy + h * 0.5 + 3, 10, 3);
        eyes(g, ox + w / 2, oy + h * 0.35, 3, 1.6);
        break;
      case 'kultist':
        g.fillTriangle(ox + w / 2, oy, ox + 2, oy + h, ox + w - 2, oy + h);
        g.fillStyle(c, 1);
        g.fillTriangle(ox + w / 2, oy + 6, ox + 6, oy + h - 2, ox + w - 6, oy + h - 2);
        g.fillStyle(0xb066ff, 1);
        g.fillCircle(ox + w - 6, oy + h * 0.55, 5);
        eyes(g, ox + w / 2, oy + h * 0.3, 3, 1.6, 0xff6666);
        break;
      case 'bomber':
        g.fillCircle(ox + w / 2, oy + h / 2 + 2, w / 2 - 1);
        g.fillStyle(c, 1);
        g.fillCircle(ox + w / 2, oy + h / 2 + 2, w / 2 - 4);
        g.lineStyle(2, 0xffd060, 1);
        g.lineBetween(ox + w / 2, oy + 4, ox + w / 2 + 6, oy - 2);
        eyes(g, ox + w / 2, oy + h / 2, 5, 2.2);
        break;
      case 'waechter':
        g.fillRoundedRect(ox, oy, w, h, 10);
        g.fillStyle(c, 1);
        g.fillRoundedRect(ox + 4, oy + 4, w - 8, h - 8, 8);
        g.lineStyle(2, 0xe8e0d0, 0.8);
        g.strokeRoundedRect(ox + 10, oy + 14, w - 20, h - 24, 6);
        eyes(g, ox + w / 2, oy + 12, 6, 2.2);
        break;
      default:
        g.fillRoundedRect(ox + 2, oy + 4, w - 4, h - 4, 8);
        g.fillStyle(c, 1);
        g.fillRoundedRect(ox + 5, oy + 7, w - 10, h - 10, 6);
        eyes(g, ox + w / 2, oy + 16, 5, 2.2);
        break;
    }
  });
}

/** Boss: großes Wesen mit Krone; die Farbe der Phase kommt als Leuchtsaum dazu (14.4). */
export function bossTexture(scene: Phaser.Scene, bossId: string, chapter: number): string {
  const key = `boss-${bossId}`;
  const W = 150;
  const H = 170;
  return make(scene, key, W, H, (g) => {
    const th = CHAPTER_THEME[chapter] ?? CHAPTER_THEME[1]!;
    const c = shade(th.accent, -0.2);
    const d = shade(th.accent, -0.65);
    g.fillStyle(d, 1);
    g.fillRoundedRect(15, 40, W - 30, H - 44, 30);
    g.fillStyle(c, 1);
    g.fillRoundedRect(22, 47, W - 44, H - 58, 26);
    g.fillStyle(0xffd24a, 1);
    g.fillTriangle(40, 46, 55, 46, 44, 18);
    g.fillTriangle(68, 46, 82, 46, 75, 8);
    g.fillTriangle(95, 46, 110, 46, 106, 18);
    eyes(g, W / 2, 80, 18, 7, 0xfff2b0);
    g.fillStyle(0x1a0d0d, 1);
    g.fillRoundedRect(W / 2 - 22, 108, 44, 10, 4);
    g.fillStyle(shade(th.accent, 0.3), 1);
    g.fillCircle(W / 2, 135, 9);
  });
}

export function shadowTexture(scene: Phaser.Scene): string {
  return make(scene, 'shadow', 64, 20, (g) => {
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(32, 10, 60, 16);
  });
}

export function dotTexture(scene: Phaser.Scene): string {
  return make(scene, 'dot', 12, 12, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(6, 6, 5);
  });
}

/** Hügel für die Parallax-Ebenen (3 Ebenen je Kapitel, 14.8). */
export function hillsTexture(scene: Phaser.Scene, chapter: number, layer: 0 | 1 | 2): string {
  const key = `hills-${chapter}-${layer}`;
  const W = 512;
  const H = 220;
  return make(scene, key, W, H, (g) => {
    const th = CHAPTER_THEME[chapter] ?? CHAPTER_THEME[1]!;
    const color = layer === 0 ? th.far : layer === 1 ? th.near : shade(th.near, -0.25);
    g.fillStyle(color, 1);
    const pts: Phaser.Math.Vector2[] = [v(0, H)];
    const peaks = layer === 0 ? 4 : layer === 1 ? 6 : 9;
    for (let i = 0; i <= peaks * 2; i++) {
      const x = (W * i) / (peaks * 2);
      const high = i % 2 === 1;
      const seed = Math.sin((i + 1) * (chapter * 3.7 + layer * 1.3)) * 0.5 + 0.5;
      const base = layer === 0 ? 60 : layer === 1 ? 110 : 160;
      pts.push(v(x, high ? base - 40 * seed : base + 10 * seed));
    }
    pts.push(v(W, H));
    g.fillPoints(pts, true);
    if (layer === 2) {
      g.fillStyle(shade(color, -0.3), 1);
      for (let i = 0; i < 6; i++) g.fillTriangle(30 + i * 85, H, 46 + i * 85, H - 50 - (i % 3) * 14, 62 + i * 85, H);
    }
  });
}

export function groundTexture(scene: Phaser.Scene, chapter: number): string {
  const key = `ground-${chapter}`;
  return make(scene, key, 256, 64, (g) => {
    const th = CHAPTER_THEME[chapter] ?? CHAPTER_THEME[1]!;
    g.fillStyle(th.ground, 1);
    g.fillRect(0, 0, 256, 64);
    g.fillStyle(shade(th.ground, 0.08), 1);
    for (let i = 0; i < 10; i++) g.fillRect((i * 53) % 256, (i * 17) % 60, 18 + (i % 3) * 6, 3);
    g.fillStyle(shade(th.ground, -0.2), 1);
    for (let i = 0; i < 8; i++) g.fillRect((i * 37 + 11) % 256, (i * 29 + 7) % 60, 10, 2);
  });
}
