// Abnahme M7 (16.2): Solo-Stage spielbar mit Platzhalter-Grafik – Stick, Fähigkeiten, Kampf, Beute-Bildschirm.
import { expect, test } from '@playwright/test';
import { admin, registerWithHero } from './helpers';

interface Probe {
  view: () => { ownId: number | null; ents: Map<number, { cur: { x: number; y: number; state: string } }>; run: { encounter: number; phase: string } | null } | null;
}

test('Solo-Stage 1: Szene, Stick, Fähigkeit, Begegnungen, Truhe', async ({ page }) => {
  await registerWithHero(page, 'jonas', 'Sternlicht', 'magier');
  admin('gear', 'Sternlicht', '5', 'selten');
  await page.reload();
  await expect(page.getByTestId('station-equip')).toBeVisible();

  await page.getByTestId('solo-start').click();
  await page.getByTestId('stage-1').click();
  await expect(page.getByTestId('run')).toBeVisible();
  await expect(page.locator('.stage-area canvas')).toBeVisible();
  const story = page.getByTestId('story');
  if (await story.isVisible()) await story.click();

  // Snapshots kommen an, der eigene Held existiert
  await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __aethra: Probe }).__aethra.view()?.ownId ?? null)).not.toBeNull();
  const ownY = () => page.evaluate(() => {
    const v = (globalThis as unknown as { __aethra: Probe }).__aethra.view();
    return v && v.ownId !== null ? v.ents.get(v.ownId)?.cur.y ?? null : null;
  });

  // Stick: nach unten ziehen bewegt den Helden (Server bestätigt die Position)
  const zone = page.locator('.stick-zone');
  const box = (await zone.boundingBox())!;
  const y0 = (await ownY())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 50, { steps: 4 });
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect.poll(async () => (await ownY())! - y0, { timeout: 5000 }).toBeGreaterThan(20);

  // Fähigkeit 1 auslösen: Abklingzeit läuft
  await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __aethra: Probe }).__aethra.view()?.run?.encounter ?? -1), { timeout: 60_000 }).toBeGreaterThanOrEqual(0);
  await page.getByTestId('skill-s1').dispatchEvent('pointerdown');
  await page.getByTestId('skill-s1').dispatchEvent('pointerup');
  await expect(page.getByTestId('skill-s1')).toHaveClass(/cooling/);

  // Ohne weitere Eingaben (Auto-Cast, Autowalk) bis zur Truhe
  await expect(page.getByTestId('loot')).toBeVisible({ timeout: 150_000 });
  await expect(page.getByTestId('loot')).toContainText('Stage geschafft');
  await page.getByTestId('loot-camp').click();
  await expect(page.getByTestId('station-equip')).toBeVisible();
});
