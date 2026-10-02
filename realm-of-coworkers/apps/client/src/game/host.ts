// Phaser-Spielinstanz für die Dauer eines Runs. Die Leinwand nutzt die Pixeldichte des Geräts (höchstens 2).
import Phaser from 'phaser';
import { RunScene } from './scene';
import type { SceneDeps } from './scene';

const MAX_DPR = 2;

export class GameHost {
  readonly game: Phaser.Game;
  private readonly ro: ResizeObserver;
  readonly dpr: number;

  constructor(private readonly parent: HTMLElement, deps: Omit<SceneDeps, 'dpr'>) {
    this.dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: Math.round(w * this.dpr),
      height: Math.round(h * this.dpr),
      backgroundColor: '#14111c',
      scale: { mode: Phaser.Scale.NONE },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      audio: { noAudio: true },
      banner: false,
      fps: { target: 60 },
      render: { antialias: true, powerPreference: 'high-performance' },
    });
    this.game.scene.add('run', RunScene, true, { ...deps, dpr: this.dpr });
    this.fitCanvas(w, h);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(parent);
  }

  get scene(): RunScene | null {
    const s = this.game.scene.getScene('run');
    return s instanceof RunScene ? s : null;
  }

  private fitCanvas(w: number, h: number): void {
    const c = this.game.canvas;
    if (!c) return;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    c.style.display = 'block';
    c.style.touchAction = 'none';
  }

  private resize(): void {
    const w = Math.max(1, this.parent.clientWidth);
    const h = Math.max(1, this.parent.clientHeight);
    this.game.scale.resize(Math.round(w * this.dpr), Math.round(h * this.dpr));
    this.fitCanvas(w, h);
  }

  destroy(): void {
    this.ro.disconnect();
    this.game.destroy(true);
  }
}
