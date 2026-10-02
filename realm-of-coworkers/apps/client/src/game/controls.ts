// Eingaben (2.3, 14.7, E-022): Stick, Tastatur und Aktionen werden zu run.input mit fortlaufender Nummer,
// höchstens 20 pro Sekunde. Die Richtung kennt 8 Stufen wie die Simulation (Vorzeichen von mx und my).
import type { ClientMsg, HeroAction } from '@aethra/shared';
import type { Vec2 } from './runview';

const MIN_INTERVAL_MS = 50;
const DEADZONE = 0.28;
/** sin(22,5°): ab hier zählt eine Achse in der 8-Richtungs-Teilung. */
const AXIS = 0.383;

type RunInput = Extract<ClientMsg, { t: 'run.input' }>;

export class Controls {
  private stick: Vec2 = { x: 0, y: 0 };
  private readonly keys = new Set<string>();
  private sent: Vec2 = { x: 0, y: 0 };
  private seq = 0;
  private lastSendAt = 0;
  private acts: HeroAction[] = [];
  private target: Vec2 | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Richtung für die Vorhersage (Vorzeichen je Achse, wie auf dem Server). */
  dir: Vec2 = { x: 0, y: 0 };

  constructor(private readonly send: (m: ClientMsg) => void) {}

  setStick(x: number, y: number): void {
    this.stick = { x, y };
    this.update();
  }

  keyDown(axis: 'up' | 'down' | 'left' | 'right'): void {
    this.keys.add(axis);
    this.update();
  }

  keyUp(axis: 'up' | 'down' | 'left' | 'right'): void {
    this.keys.delete(axis);
    this.update();
  }

  releaseAll(): void {
    this.keys.clear();
    this.stick = { x: 0, y: 0 };
    this.update();
  }

  act(a: HeroAction): void {
    this.acts.push(a);
    this.flush();
  }

  /** Klick bzw. Antippen auf den Boden: dorthin laufen (14.7). */
  moveTo(x: number, y: number): void {
    this.target = { x: Math.round(x), y: Math.round(y) };
    this.flush();
  }

  private quantize(): Vec2 {
    let x = (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0);
    let y = (this.keys.has('down') ? 1 : 0) - (this.keys.has('up') ? 1 : 0);
    const len = Math.hypot(this.stick.x, this.stick.y);
    if (x === 0 && y === 0 && len > DEADZONE) {
      const nx = this.stick.x / len;
      const ny = this.stick.y / len;
      x = Math.abs(nx) >= AXIS ? Math.sign(nx) : 0;
      y = Math.abs(ny) >= AXIS ? Math.sign(ny) : 0;
    }
    return { x, y };
  }

  private update(): void {
    const q = this.quantize();
    this.dir = q;
    if (q.x !== this.sent.x || q.y !== this.sent.y) this.flush();
  }

  private flush(): void {
    if (this.timer) return;
    const wait = this.lastSendAt + MIN_INTERVAL_MS - performance.now();
    if (wait > 0) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush();
      }, wait);
      return;
    }
    const q = this.quantize();
    const m: RunInput = { t: 'run.input', seq: ++this.seq, mx: q.x, my: q.y };
    if (this.target && q.x === 0 && q.y === 0) {
      m.tx = this.target.x;
      m.ty = this.target.y;
    }
    if (this.acts.length > 0) m.act = this.acts.splice(0, 8);
    this.target = null;
    this.sent = q;
    this.lastSendAt = performance.now();
    this.send(m);
    if (this.acts.length > 0) this.flush();
  }
}
