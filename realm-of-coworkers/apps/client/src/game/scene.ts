// Spielszene (14.3, 14.4, 14.8): Einheiten aus den Snapshots, Telegraphen (14.6), schwebende Zahlen, Pings,
// Parallax-Hintergrund. Phaser zeichnet nur; Eingaben laufen über die HTML-Ebene darüber.
import Phaser from 'phaser';
import type { ClassId, Content, ElementId, GameEvent } from '@aethra/shared';
import type { Settings } from '../lib/settings';
import { CHAPTER_THEME, dangerColor, elementColor, healColor } from './palette';
import type { EntView, RunView, Vec2 } from './runview';
import { DIRS, FIGUR_H, FOOT, animKey, createAnims, queueSprites, richtung, spriteKey, stillFrame } from './sprites';
import type { Dir } from './sprites';
import {
  HERO_H, bossTexture, dotTexture, enemySize, enemyTexture, groundTexture, heroTexture, hillsTexture, shadowTexture,
} from './textures';

/** Weltkoordinate y = 0 liegt in der Szene bei BAND_TOP (Himmel darüber). */
export const BAND_TOP = 160;
const BOTTOM_MARGIN = 26;
const MIN_VIEW_H = 400;
const MIN_VIEW_W_LANDSCAPE = 640;
const MIN_VIEW_W_PORTRAIT = 540;
const NUMBER_POOL = 48;
const NUMBER_MS = 900;
const NUMBER_RISE = 46;
const TRACER_MS = 140;
const FLASH_MS = 70;  // kurz halten: Sprites werden beim Treffer ganz weiß (OPEN-051)
const FADE_MS = 400;
const CAMERA_LERP = 6;
const TAP_RADIUS = 42;

export interface SceneDeps {
  content: Content;
  view: () => RunView | null;
  settings: () => Settings;
  /** Aktuelle Eingaberichtung des eigenen Helden (für die Vorhersage). */
  ownDir: () => Vec2;
  /** Ereignisse seit dem letzten Frame. */
  drainEvents: () => GameEvent[];
  dpr: number;
}

interface UnitGfx {
  body: Phaser.GameObjects.Sprite;
  /** Figur im Sprite-Atlas (OPEN-051); null = Platzhalter aus textures.ts */
  figur: string | null;
  dir: Dir;
  shadow: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text | null;
  glow: Phaser.GameObjects.Arc | null;
  h: number;
  flashUntil: number;
  fadeStart: number | null;
  x: number;
  y: number;
}

interface FloatNum {
  text: Phaser.GameObjects.Text;
  start: number;
  x: number;
  y: number;
  active: boolean;
}

interface Tracer {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: number;
  start: number;
}

interface PingMark {
  x: number;
  y: number;
  kind: string;
  until: number;
  text: Phaser.GameObjects.Text;
}

export class RunScene extends Phaser.Scene {
  private deps!: SceneDeps;
  private readonly units = new Map<number, UnitGfx>();
  private zonesG!: Phaser.GameObjects.Graphics;
  private barsG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private markersG!: Phaser.GameObjects.Graphics;
  private layers: Phaser.GameObjects.TileSprite[] = [];
  private ground!: Phaser.GameObjects.TileSprite;
  private sky!: Phaser.GameObjects.Rectangle;
  private readonly numbers: FloatNum[] = [];
  private tracers: Tracer[] = [];
  private pings: PingMark[] = [];
  private bossText: { text: Phaser.GameObjects.Text; until: number } | null = null;
  private camX = 0;
  private chapter = 0;
  /** Geladene Sprite-Figuren mit ihrer Größe. */
  private figuren = new Map<string, number>();
  /** Erst nach create() zeichnet die Szene; davor lädt Phaser die Sprites (OPEN-051). */
  bereit = false;
  private markersFor = '';
  private lastNow = 0;

  constructor() {
    super('run');
  }

  init(deps: SceneDeps): void {
    this.deps = deps;
  }

  preload(): void {
    queueSprites(this);
  }

  create(): void {
    this.figuren = createAnims(this);
    shadowTexture(this);
    dotTexture(this);
    this.sky = this.add.rectangle(0, 0, 10, 10, 0x000000).setOrigin(0, 0).setScrollFactor(0).setDepth(-100);
    this.markersG = this.add.graphics().setDepth(-5);
    this.zonesG = this.add.graphics().setDepth(-4);
    this.barsG = this.add.graphics().setDepth(100_000);
    this.fxG = this.add.graphics().setDepth(100_001);
    this.cameras.main.setRoundPixels(false);
    this.scale.on('resize', () => this.layout());
    this.layout();
    this.bereit = true;
  }

  // ---------- Kamera und Hintergrund ----------

  private zoom(): number {
    const { width, height } = this.scale.gameSize;
    const cssW = width / this.deps.dpr;
    const cssH = height / this.deps.dpr;
    const minW = cssW < cssH ? MIN_VIEW_W_PORTRAIT : MIN_VIEW_W_LANDSCAPE;
    return this.deps.dpr * Math.min(cssW / minW, cssH / MIN_VIEW_H);
  }

  private layout(): void {
    const cam = this.cameras.main;
    const { width, height } = this.scale.gameSize;
    cam.setSize(width, height);
    cam.setZoom(this.zoom());
    this.sky.setSize(width, height);
  }

  private setChapter(ch: number): void {
    if (ch === this.chapter) return;
    this.chapter = ch;
    for (const l of this.layers) l.destroy();
    this.layers = [];
    this.ground?.destroy();
    const th = CHAPTER_THEME[ch] ?? CHAPTER_THEME[1]!;
    this.sky.setFillStyle(th.sky);
    const ys = [BAND_TOP - 150, BAND_TOP - 110, BAND_TOP - 70];
    ([0, 1, 2] as const).forEach((layer, i) => {
      const ts = this.add.tileSprite(0, ys[i]!, 4096, 220, hillsTexture(this, ch, layer)).setOrigin(0, 0).setDepth(-50 + i);
      this.layers.push(ts);
    });
    this.ground = this.add.tileSprite(0, BAND_TOP - 30, 4096, 240 + 30 + BOTTOM_MARGIN + 200, groundTexture(this, ch)).setOrigin(0, 0).setDepth(-10);
  }

  /** Bildschirm (CSS-Pixel in der Spielfläche) → Welt (Stage-Koordinaten). */
  screenToWorld(cssX: number, cssY: number): Vec2 {
    const p = this.cameras.main.getWorldPoint(cssX * this.deps.dpr, cssY * this.deps.dpr);
    return { x: p.x, y: p.y - BAND_TOP };
  }

  /** Gegner unter dem Finger (Fokus per Antippen, 14.7). */
  enemyAt(world: Vec2): number | null {
    let best: number | null = null;
    let bestD = TAP_RADIUS;
    for (const [id, g] of this.units) {
      const e = this.deps.view()?.ents.get(id);
      if (!e || e.kind === 'hero' || e.cur.state === 'dead') continue;
      const cy = g.y - g.h / 2;
      const d = Math.hypot(g.x - world.x, cy - world.y) - g.h / 4;
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  // ---------- Frame ----------

  override update(_time: number, delta: number): void {
    const view = this.deps.view();
    if (!view) return;
    const now = performance.now();
    this.lastNow = now;
    const st = this.deps.settings();
    const run = view.run;
    const chapter = Math.ceil(view.start.stage / 5);
    this.setChapter(chapter);
    const rt = view.renderTime(now);
    const ownPos = view.stepOwn(now, Math.min(delta, 100), this.deps.ownDir(), rt);

    // Einheiten
    for (const e of view.ents.values()) {
      let g = this.units.get(e.id);
      if (!g) g = this.createUnit(e, chapter);
      const pos = e.id === view.ownId && ownPos ? ownPos : view.sample(e, rt);
      this.placeUnit(e, g, pos, now, rt, e.id === view.ownId);
    }
    for (const [id, g] of this.units) {
      if (!view.ents.has(id)) this.destroyUnit(id, g);
    }

    // Kamera: Stage folgt dem Anker (vom Server), Arena der Mitte zwischen eigenem Held und Boss
    const cam = this.cameras.main;
    let target = run?.cameraX ?? this.camX;
    if (run?.arena) {
      const own = view.own();
      const boss = [...view.ents.values()].find((x) => x.kind === 'boss' && x.removedAt === null);
      const ox = own ? (ownPos?.x ?? own.cur.x) : run.worldWidth / 2;
      target = boss ? (ox + view.sample(boss, rt).x) / 2 : ox;
      const half = cam.width / cam.zoom / 2;
      target = run.worldWidth <= half * 2 ? run.worldWidth / 2 : Math.max(half, Math.min(run.worldWidth - half, target));
    }
    if (this.camX === 0) this.camX = target;
    this.camX += (target - this.camX) * Math.min(1, (delta / 1000) * CAMERA_LERP);
    const viewH = cam.height / cam.zoom;
    cam.centerOn(this.camX, BAND_TOP + 240 + BOTTOM_MARGIN - viewH / 2);
    const left = this.camX - cam.width / cam.zoom / 2;
    this.layers.forEach((l, i) => {
      l.x = left - 64;
      l.width = cam.width / cam.zoom + 128;
      l.tilePositionX = left * (0.15 + i * 0.2);
    });
    if (this.ground) {
      this.ground.x = left - 64;
      this.ground.width = cam.width / cam.zoom + 128;
      this.ground.tilePositionX = left;
    }

    this.drawMarkers(view);
    this.drawZones(view, rt, st);
    this.drawBars(view);
    for (const ev of this.deps.drainEvents()) this.onEvent(ev, view, rt, st);
    this.drawFx(now);
    this.updateNumbers(now);
  }

  // ---------- Einheiten ----------

  private createUnit(e: EntView, chapter: number): UnitGfx {
    let key: string;
    let h: number;
    const cls = (e.meta.cls ?? 'krieger') as ClassId;
    const type = e.meta.type ?? 'scherge';
    const wunsch = e.kind === 'hero' ? cls : e.kind === 'boss' ? e.meta.boss ?? '' : type;
    const figur = this.figuren.has(wunsch) ? wunsch : null;
    const skala = figur ? this.figuren.get(figur)! : 1;
    if (figur) {
      key = spriteKey(figur);
      h = Math.round(FIGUR_H * skala);
    } else if (e.kind === 'hero') {
      key = heroTexture(this, cls, e.meta.look?.[0] ?? 0, e.meta.look?.[1] ?? 0);
      h = HERO_H;
    } else if (e.kind === 'boss') {
      key = bossTexture(this, e.meta.boss ?? 'boss', chapter);
      h = 170;
    } else {
      key = enemyTexture(this, type, chapter, !!e.meta.elite);
      h = enemySize(type)[1] + 8;
    }
    const shadow = this.add.image(e.cur.x, BAND_TOP + e.cur.y, 'shadow').setOrigin(0.5, 0.5);
    if (e.kind === 'boss') shadow.setScale(2.4, 2);
    const dir: Dir = e.cur.face < 0 ? 'w' : 'e';
    const body = this.add.sprite(e.cur.x, BAND_TOP + e.cur.y, key).setOrigin(0.5, figur ? FOOT : 1);
    if (figur) body.setFrame(stillFrame(this, dir)).setScale(skala);
    // Elite (9.7): goldener Schatten statt des goldenen Rahmens der Platzhalter
    if (figur && e.meta.elite) shadow.setTint(0xffcc44).setScale(1.3, 1.1);
    let name: Phaser.GameObjects.Text | null = null;
    if (e.kind === 'hero' && e.meta.name) {
      name = this.add.text(0, 0, e.meta.name, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1);
    }
    let glow: Phaser.GameObjects.Arc | null = null;
    if (e.kind === 'boss') glow = this.add.circle(0, 0, 90, 0xffffff, 0.12).setStrokeStyle(4, 0xffffff, 0.6);
    const g: UnitGfx = { body, shadow, name, glow, h, figur, dir, flashUntil: 0, fadeStart: null, x: e.cur.x, y: e.cur.y };
    this.units.set(e.id, g);
    return g;
  }

  private placeUnit(e: EntView, g: UnitGfx, pos: Vec2, now: number, rt: number, own: boolean): void {
    if (g.figur) this.animateSprite(e, g, pos);
    g.x = pos.x;
    g.y = pos.y;
    const sy = BAND_TOP + pos.y;
    const dead = e.cur.state === 'dead';
    const depth = sy;
    g.body.setPosition(pos.x, sy).setDepth(depth).setFlipX(!g.figur && e.cur.face < 0);
    g.shadow.setPosition(pos.x, sy).setDepth(depth - 0.5);
    let alpha = 1;
    if (e.removedAt !== null && rt >= e.removedAt) {
      g.fadeStart ??= now;
      alpha = Math.max(0, 1 - (now - g.fadeStart) / FADE_MS);
    }
    if (dead) {
      // Sprites fallen über die Treffer-Animation um, Platzhalter werden gekippt
      if (!g.figur) g.body.setAngle(e.cur.face < 0 ? -80 : 80);
      g.body.setTint(0x777777);
      alpha *= e.kind === 'hero' ? 0.75 : 0.5;
    } else {
      g.body.setAngle(e.cur.state === 'stun' ? Math.sin(now / 60) * 8 : 0);
      if (now < g.flashUntil) g.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else if (e.cur.state === 'roll') g.body.setTint(0xaaddff).setTintMode(Phaser.TintModes.MULTIPLY);
      else g.body.clearTint();
    }
    // Platzhalter bekommen Wippen und Strecken aus Code; Sprites haben echte Animationen
    if (!g.figur) {
      const walk = e.cur.state === 'walk' ? Math.abs(Math.sin(now / 90)) * 3 : 0;
      const act = e.cur.state === 'attack' || e.cur.state === 'cast' ? 1.06 : 1;
      if (!dead) g.body.setScale(act, act).setY(sy - walk);
    }
    g.body.setAlpha(alpha);
    g.shadow.setAlpha(alpha);
    if (g.name) {
      g.name.setPosition(pos.x, sy - g.h - 14).setDepth(100_000).setAlpha(alpha);
      g.name.setColor(own ? '#ffd24a' : '#ffffff');
    }
    if (g.glow) {
      const el = (e.cur.el ?? 'physisch') as ElementId;
      const c = elementColor(el, this.deps.settings().colorBlind);
      g.glow.setPosition(pos.x, sy - g.h / 2).setDepth(depth - 1).setFillStyle(c, 0.14).setStrokeStyle(4, c, 0.7).setAlpha(alpha);
    }
  }

  /** Wählt Animation und Blickrichtung aus Zustand und Bewegung (OPEN-051). */
  private animateSprite(e: EntView, g: UnitGfx, pos: Vec2): void {
    const id = g.figur!;
    const st = e.cur.state;
    g.dir = richtung(pos.x - g.x, pos.y - g.y, e.cur.face, g.dir);
    const dir = st === 'dead' ? 's' : g.dir;
    if (st === 'dead') {
      if (g.body.anims.getName() !== animKey(id, 'hurt', 's')) g.body.play(animKey(id, 'hurt', 's'));
      return;
    }
    if (st === 'attack' || st === 'cast') {
      g.body.play({ key: animKey(id, 'attack', dir) }, true);
      return;
    }
    if (st === 'walk' || st === 'roll') {
      g.body.play({ key: animKey(id, 'walk', dir) }, true);
      return;
    }
    // Ruhe: laufende Einmal-Animation (Angriff) ausspielen lassen, sonst erstes Laufbild
    if (g.body.anims.isPlaying && !DIRS.some((d) => g.body.anims.getName() === animKey(id, 'walk', d))) return;
    g.body.stop();
    g.body.setFrame(stillFrame(this, dir));
  }

  private destroyUnit(id: number, g: UnitGfx): void {
    g.body.destroy();
    g.shadow.destroy();
    g.name?.destroy();
    g.glow?.destroy();
    this.units.delete(id);
  }

  // ---------- Leisten, Flächen, Markierungen ----------

  private drawBars(view: RunView): void {
    const b = this.barsG;
    b.clear();
    // Wutwechsel (14.4): roter Pfeil über dem Helden, den der Boss angreift
    for (const e of view.ents.values()) { // OPEN-042
      if (e.kind !== 'boss' || e.removedAt !== null || e.cur.tgt === undefined) continue;
      const tg = this.units.get(e.cur.tgt);
      if (!tg || tg.fadeStart !== null) continue;
      const ty = BAND_TOP + tg.y - tg.h - 30 + Math.sin(this.lastNow / 140) * 3;
      b.fillStyle(0xff3b3b, 1);
      b.fillTriangle(tg.x - 9, ty - 10, tg.x + 9, ty - 10, tg.x, ty + 2);
      b.fillRect(tg.x - 3, ty - 20, 6, 10);
    }
    // Bedrohungskrone (14.3, OPEN-042): über dem Helden, den die meisten Gegner gerade angreifen
    const angreifer = new Map<number, number>();
    for (const e of view.ents.values()) {
      if (e.kind === 'hero' || e.removedAt !== null || e.cur.tgt === undefined || e.cur.state === 'dead') continue;
      angreifer.set(e.cur.tgt, (angreifer.get(e.cur.tgt) ?? 0) + 1);
    }
    let kronenId = -1;
    let meiste = 0;
    for (const [id, n] of [...angreifer].sort((a, c) => a[0] - c[0])) {
      if (n > meiste) {
        meiste = n;
        kronenId = id;
      }
    }
    const kg = kronenId >= 0 ? this.units.get(kronenId) : undefined;
    if (kg && kg.fadeStart === null && meiste > 0) {
      const cx = kg.x;
      const cy = BAND_TOP + kg.y - kg.h - 26;
      b.fillStyle(0xffd24a, 1);
      b.fillTriangle(cx - 7, cy + 4, cx - 5, cy - 4, cx - 2, cy + 4);
      b.fillTriangle(cx - 3, cy + 4, cx, cy - 6, cx + 3, cy + 4);
      b.fillTriangle(cx + 2, cy + 4, cx + 5, cy - 4, cx + 7, cy + 4);
      b.fillRect(cx - 7, cy + 3, 14, 3);
    }

    // Fokusziel (14.7): Ring am Boden
    const focus = view.run?.me?.focusId;
    const fg = focus !== null && focus !== undefined ? this.units.get(focus) : undefined;
    if (fg && fg.fadeStart === null) {
      b.lineStyle(2, 0xffd24a, 0.95);
      b.strokeEllipse(fg.x, BAND_TOP + fg.y, Math.max(48, fg.h * 0.9), 18);
    }
    for (const [id, g] of this.units) {
      const e = view.ents.get(id);
      if (!e || e.kind === 'boss' || e.cur.state === 'dead' || g.fadeStart !== null) continue;
      const w = e.kind === 'hero' ? 40 : e.meta.elite ? 46 : 34;
      const x = g.x - w / 2;
      const y = BAND_TOP + g.y - g.h - (e.kind === 'hero' ? 10 : 6);
      const frac = Math.max(0, Math.min(1, e.cur.hp / Math.max(1, e.cur.maxHp)));
      b.fillStyle(0x000000, 0.65);
      b.fillRect(x - 1, y - 1, w + 2, 6);
      const color = e.kind === 'hero' ? (id === view.ownId ? 0x5ee07a : 0x4cb8ff) : 0xe5484d;
      b.fillStyle(color, 1);
      b.fillRect(x, y, w * frac, 4);
      if (e.cur.shield) {
        const sf = Math.min(1, e.cur.shield / Math.max(1, e.cur.maxHp));
        b.fillStyle(0xe8f4ff, 0.9);
        b.fillRect(x, y - 3, w * sf, 2);
      }
      if (e.meta.elite) {
        b.lineStyle(1, 0xffc94a, 1);
        b.strokeRect(x - 1, y - 1, w + 2, 6);
      }
      // Effekte als kleine Punkte (höchstens 8, 14.3)
      const fx = e.cur.fx ?? [];
      fx.slice(0, 8).forEach((f, i) => {
        b.fillStyle(f.id.startsWith('buff') || ['segen', 'kraftrune', 'eile', 'bollwerk', 'adlerauge', 'tarnung'].includes(f.id) ? 0x8ef08e : 0xffb050, 1);
        b.fillRect(x + i * 5, y + 6, 4, 3);
      });
    }
  }

  private drawZones(view: RunView, rt: number, st: Settings): void {
    const g = this.zonesG;
    g.clear();
    const danger = dangerColor(st.telegraph, st.colorBlind);
    for (const zv of view.zones) {
      const z = zv.z;
      const prog = z.total > 0 ? Math.max(0, Math.min(1, (rt - zv.startedAt) / z.total)) : 1;
      const cx = z.x;
      const cy = BAND_TOP + z.y;
      const own = !z.hostile;
      const color = own ? healColor(st.colorBlind) : z.kind === 'aura' ? 0xc070ff : danger;
      const outline = !own && st.telegraph === 'outline';
      const fillA = outline ? 0 : z.kind === 'hazard' && z.endsIn <= 0 ? 0.25 : 0.35 * (own ? 0.5 : 1);
      const path = () => {
        if (z.shape === 'circle') {
          g.beginPath();
          g.arc(cx, cy, z.w, 0, Math.PI * 2, false);
          g.closePath();
        } else if (z.shape === 'line') {
          const a = z.ang ?? 0;
          const ux = Math.cos(a);
          const uy = Math.sin(a);
          const hw = z.w / 2;
          const hh = z.h / 2;
          g.beginPath();
          g.moveTo(cx - ux * hw - uy * hh, cy - uy * hw + ux * hh);
          g.lineTo(cx + ux * hw - uy * hh, cy + uy * hw + ux * hh);
          g.lineTo(cx + ux * hw + uy * hh, cy + uy * hw - ux * hh);
          g.lineTo(cx - ux * hw + uy * hh, cy - uy * hw - ux * hh);
          g.closePath();
        } else {
          const a = z.ang ?? 0;
          const half = (z.h * Math.PI) / 360;
          g.beginPath();
          g.moveTo(cx, cy);
          g.arc(cx, cy, z.w, a - half, a + half, false);
          g.closePath();
        }
      };
      if (fillA > 0) {
        g.fillStyle(color, fillA);
        path();
        g.fillPath();
      }
      g.lineStyle(outline ? 5 : 3, outline ? 0xffffff : color, 0.95);
      path();
      g.strokePath();
      if (outline) {
        g.lineStyle(2, 0x000000, 1);
        path();
        g.strokePath();
      }
      // Zeitverlauf: Füllung wächst von innen (Standard) bzw. Kreisbogen (Kontur)
      if (z.kind === 'telegraph' && prog < 1) {
        if (outline) {
          g.lineStyle(4, 0xffffff, 1);
          g.beginPath();
          g.arc(cx, cy, 16, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2, false);
          g.strokePath();
          g.fillStyle(0xffffff, 1);
          g.fillTriangle(cx, cy - 8, cx - 7, cy + 5, cx + 7, cy + 5);
        } else if (z.shape === 'circle') {
          g.fillStyle(color, 0.35);
          g.fillCircle(cx, cy, z.w * prog);
        } else {
          g.fillStyle(color, 0.2 * prog);
          path();
          g.fillPath();
        }
      }
    }
  }

  /** Begegnungen, Checkpoints und Zielflagge auf dem Boden (9.1). */
  private drawMarkers(view: RunView): void {
    const run = view.run;
    if (!run) return;
    const key = `${view.start.stage}-${run.arena}`;
    if (key === this.markersFor) return;
    this.markersFor = key;
    const g = this.markersG;
    g.clear();
    if (run.arena) return;
    const def = this.deps.content.stages[view.start.stage - 1];
    if (!def) return;
    for (const enc of def.encounters) {
      g.fillStyle(0x000000, 0.25);
      g.fillRect(enc.x - 2, BAND_TOP - 20, 4, 270);
    }
    for (const cx of def.checkpoints) {
      g.fillStyle(0x6ec6f0, 0.9);
      g.fillRect(cx - 3, BAND_TOP - 60, 6, 70);
      g.fillCircle(cx, BAND_TOP - 64, 9);
    }
    g.fillStyle(0xffffff, 1);
    g.fillRect(def.lengthPx - 3, BAND_TOP - 90, 6, 100);
    g.fillStyle(0xffd24a, 1);
    g.fillTriangle(def.lengthPx + 3, BAND_TOP - 90, def.lengthPx + 46, BAND_TOP - 74, def.lengthPx + 3, BAND_TOP - 58);
  }

  // ---------- Ereignisse ----------

  private posOf(view: RunView, id: number, rt: number): { x: number; y: number; h: number } | null {
    const g = this.units.get(id);
    if (g) return { x: g.x, y: g.y, h: g.h };
    const e = view.ents.get(id);
    if (!e) return null;
    const p = view.sample(e, rt);
    return { x: p.x, y: p.y, h: HERO_H };
  }

  private onEvent(ev: GameEvent, view: RunView, rt: number, st: Settings): void {
    const now = this.lastNow;
    switch (ev.e) {
      case 'hit': {
        const d = this.posOf(view, ev.dst, rt);
        if (!d) return;
        const g = this.units.get(ev.dst);
        if (g) g.flashUntil = now + FLASH_MS;
        const s = this.posOf(view, ev.src, rt);
        if (s && Math.hypot(s.x - d.x, s.y - d.y) > 130 && !ev.dot) {
          const el = (ev.el ?? 'physisch') as ElementId;
          this.tracers.push({ x0: s.x, y0: s.y - s.h * 0.6, x1: d.x, y1: d.y - d.h * 0.5, color: elementColor(el, st.colorBlind), start: now });
        }
        if (!st.damageNumbers) return;
        const own = ev.src === view.ownId || ev.dst === view.ownId;
        if (!own && !ev.crit && this.activeNumbers() > 30) return;
        const el = (ev.el ?? 'physisch') as ElementId;
        const color = ev.crit ? 0xffe14a : el === 'physisch' ? 0xffffff : elementColor(el, st.colorBlind);
        this.number(`${ev.dmg}${ev.crit ? '!' : ''}`, d.x, d.y - d.h, color, ev.crit ? 22 : 16);
        return;
      }
      case 'heal': {
        if (ev.amount < 1 || !st.damageNumbers) return;
        const d = this.posOf(view, ev.dst, rt);
        if (d) this.number(`+${ev.amount}`, d.x, d.y - d.h, healColor(st.colorBlind), 15);
        return;
      }
      case 'cast': {
        // Nur Fähigkeiten blitzen auf, nicht jeder Automatikangriff
        const def = this.deps.content.skillById.get(ev.skill);
        const g = this.units.get(ev.id);
        if (g && def && def.slot !== 'auto') g.flashUntil = now + FLASH_MS;
        return;
      }
      case 'revive': {
        const d = this.posOf(view, ev.id, rt);
        if (d) this.number('✚', d.x, d.y - d.h, healColor(st.colorBlind), 26);
        return;
      }
      case 'ping': {
        const icon = ev.kind === 'danger' ? '⚠' : ev.kind === 'help' ? '✋' : '◆';
        const text = this.add.text(ev.x, BAND_TOP + ev.y - 30, icon, {
          fontFamily: 'system-ui, sans-serif', fontSize: '28px', color: ev.kind === 'danger' ? '#ff6b6b' : ev.kind === 'help' ? '#7cd6ff' : '#ffe66b',
          stroke: '#000000', strokeThickness: 4,
        }).setOrigin(0.5, 1).setDepth(100_002);
        this.pings.push({ x: ev.x, y: ev.y, kind: ev.kind, until: now + this.deps.content.engine.party.pingMs, text });
        return;
      }
      case 'bossText': {
        const b = this.posOf(view, ev.boss, rt);
        this.bossText?.text.destroy();
        const text = this.add.text(b?.x ?? this.camX, BAND_TOP - 40, ev.text, {
          fontFamily: 'system-ui, sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#ffe0a0', stroke: '#2a0a00', strokeThickness: 5,
        }).setOrigin(0.5, 1).setDepth(100_003);
        this.bossText = { text, until: now + 2000 };
        return;
      }
      default:
        return;
    }
  }

  private drawFx(now: number): void {
    const g = this.fxG;
    g.clear();
    this.tracers = this.tracers.filter((t) => now - t.start < TRACER_MS);
    for (const t of this.tracers) {
      const k = (now - t.start) / TRACER_MS;
      const x = t.x0 + (t.x1 - t.x0) * k;
      const y = BAND_TOP + t.y0 + (t.y1 - t.y0) * k;
      g.fillStyle(t.color, 1);
      g.fillCircle(x, y, 4);
      g.lineStyle(2, t.color, 0.5);
      g.lineBetween(x - (t.x1 - t.x0) * 0.08, y - (t.y1 - t.y0) * 0.08, x, y);
    }
    this.pings = this.pings.filter((p) => {
      if (now >= p.until) {
        p.text.destroy();
        return false;
      }
      const pulse = 1 + Math.sin(now / 120) * 0.15;
      g.lineStyle(3, p.kind === 'danger' ? 0xff6b6b : p.kind === 'help' ? 0x7cd6ff : 0xffe66b, 0.9);
      g.strokeEllipse(p.x, BAND_TOP + p.y, 46 * pulse, 18 * pulse);
      return true;
    });
    if (this.bossText && now >= this.bossText.until) {
      this.bossText.text.destroy();
      this.bossText = null;
    }
  }

  // ---------- Zahlen ----------

  private activeNumbers(): number {
    return this.numbers.filter((n) => n.active).length;
  }

  private number(s: string, x: number, y: number, color: number, size: number): void {
    let n = this.numbers.find((f) => !f.active);
    if (!n) {
      if (this.numbers.length >= NUMBER_POOL) return;
      const text = this.add.text(0, 0, '', {
        fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5, 1).setDepth(100_010);
      n = { text, start: 0, x: 0, y: 0, active: false };
      this.numbers.push(n);
    }
    n.active = true;
    n.start = this.lastNow;
    n.x = x + (Math.random() - 0.5) * 16;
    n.y = y;
    n.text.setText(s).setFontSize(size).setColor(`#${color.toString(16).padStart(6, '0')}`).setVisible(true);
  }

  private updateNumbers(now: number): void {
    const reduce = this.deps.settings().reduceMotion;
    for (const n of this.numbers) {
      if (!n.active) continue;
      const k = (now - n.start) / NUMBER_MS;
      if (k >= 1) {
        n.active = false;
        n.text.setVisible(false);
        continue;
      }
      n.text.setPosition(n.x, BAND_TOP + n.y - (reduce ? 10 : NUMBER_RISE * k)).setAlpha(1 - k * k);
    }
  }
}
