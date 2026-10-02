// Hilfen für die Browser-Tests: Konto und Held über die Oberfläche anlegen, Testdaten über die Verwaltung (pnpm admin).
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const INVITE = 'e2e-kollegen';

/** Verwaltungsbefehl gegen die Datenbank des Test-Servers. */
export function admin(...args: string[]): string {
  return execFileSync('node', [resolve(root, 'apps/server/dist/admin.js'), ...args], {
    env: { ...process.env, DB_PATH: resolve(root, 'e2e-data/e2e.db'), LOG_LEVEL: 'warn' },
    cwd: resolve(root, 'apps/server'),
    encoding: 'utf8',
  });
}

export async function registerWithHero(page: Page, user: string, heroName: string, cls: string): Promise<void> {
  await page.goto('/');
  await page.getByTestId('login-toggle').click();
  await page.getByTestId('login-username').fill(user);
  await page.getByTestId('login-password').fill('geheim123');
  await page.getByTestId('login-invite').fill(INVITE);
  await page.getByTestId('login-submit').click();
  await page.getByTestId('hero-new').click();
  await page.getByTestId(`class-${cls}`).click();
  await page.getByTestId('hero-name').fill(heroName);
  await page.getByTestId('hero-create-submit').click();
  await expect(page.getByTestId('station-equip')).toBeVisible();
  await expect(page.getByTestId('hero-name-display')).toHaveText(heroName);
}
