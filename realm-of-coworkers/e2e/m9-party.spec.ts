// Mehrspieler im Browser (16.4): Party mit 2 Browsern per Code, Chat, Bereit, gemeinsamer Run, Wiederverbindung.
import { devices, expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { registerWithHero } from './helpers';

const heroesInView = (p: Page) => p.evaluate(() => {
  const v = (globalThis as unknown as { __aethra: { view: () => { ents: Map<number, { kind: string; removedAt: number | null }> } | null } }).__aethra.view();
  return v ? [...v.ents.values()].filter((e) => e.kind === 'hero' && e.removedAt === null).length : 0;
});

test('Zwei Kollegen: Party per Code, Chat, gemeinsamer Run, Wiederverbindung', async ({ browser }) => {
  const ctxA = await browser.newContext({ ...devices['Pixel 7'] });
  const ctxB = await browser.newContext({ ...devices['Pixel 7'] });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  await registerWithHero(a, 'lea', 'Funkenflug', 'magier');
  await registerWithHero(b, 'tom', 'Eichenschild', 'krieger');

  // Lea erstellt die Party, Tom tritt mit dem Code bei
  await a.getByTestId('party-create').click();
  const code = (await a.getByTestId('party-code').innerText()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  await b.getByTestId('party-join').click();
  await b.getByTestId('party-code-input').fill(code);
  await b.getByTestId('party-join-submit').click();
  await expect(a.getByTestId('party-panel')).toContainText('Eichenschild');
  await expect(b.getByTestId('party-panel')).toContainText('Funkenflug');

  // Chat in der Party
  await b.getByTestId('chat-open').click();
  await b.getByTestId('chat-input').fill('Mittagspause? Ich bin dabei!');
  await b.getByTestId('chat-input').press('Enter');
  await a.getByTestId('chat-open').click();
  await expect(a.getByTestId('chat-lines')).toContainText('Mittagspause? Ich bin dabei!');
  await a.keyboard.press('Escape');
  await b.keyboard.press('Escape');

  // Stage wählen (Anführerin), beide bereit: Countdown und gemeinsamer Run
  await a.getByTestId('party-stage').click();
  await a.getByTestId('stage-1').click();
  await expect(b.getByTestId('party-panel')).toContainText('Stage 1-1');
  await a.getByTestId('party-ready').click();
  await b.getByTestId('party-ready').click();
  await expect(a.getByTestId('run')).toBeVisible({ timeout: 20_000 });
  await expect(b.getByTestId('run')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => heroesInView(a), { timeout: 15_000 }).toBe(2);
  await expect.poll(() => heroesInView(b), { timeout: 15_000 }).toBe(2);

  // Tom lädt die Seite neu (Handy gesperrt, Tab gewechselt): er landet wieder im laufenden Run
  await b.reload();
  await expect(b.getByTestId('run')).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => heroesInView(b), { timeout: 15_000 }).toBe(2);
  await ctxA.close();
  await ctxB.close();
});
