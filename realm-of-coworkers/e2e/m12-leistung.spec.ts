// Leistung des Clients (2.7, 16.3): 6 Helden und 40 Einheiten, Rechenzeit der Szene je Frame und Ladegröße.
// Die Bildrate selbst hängt hier vom Software-Renderer ab und wird nur ausgegeben.
import { expect, test } from '@playwright/test';

interface Bench {
  frames: number;
  avgUpdateMs: number;
  p95UpdateMs: number;
  fps: number;
  done: boolean;
}

test('Szene mit 6 Helden und 40 Gegnern: Rechenzeit je Frame deutlich unter 16 ms', async ({ page }) => {
  await page.goto('/?bench');
  await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __bench?: Bench }).__bench?.done ?? false), { timeout: 60_000 }).toBe(true);
  const b = await page.evaluate(() => (globalThis as unknown as { __bench: Bench }).__bench);
  console.log(`Leistung: ${b.frames} Frames, Szene ${b.avgUpdateMs.toFixed(2)} ms im Mittel, P95 ${b.p95UpdateMs.toFixed(2)} ms, ${b.fps.toFixed(0)} FPS (Software-Renderer)`);
  expect(b.frames).toBeGreaterThan(20);
  expect(b.avgUpdateMs).toBeLessThan(4);
  expect(b.p95UpdateMs).toBeLessThan(8);
});

test('Erstladen unter 3 MB (2.7)', async ({ page }) => {
  let bytes = 0;
  page.on('response', async (r) => {
    const len = Number(r.headers()['content-length'] ?? 0);
    if (len) bytes += len;
    else bytes += (await r.body().catch(() => Buffer.alloc(0))).length;
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  console.log(`Erstladen: ${(bytes / 1024).toFixed(0)} KB`);
  expect(bytes).toBeLessThan(3 * 1024 * 1024);
});
