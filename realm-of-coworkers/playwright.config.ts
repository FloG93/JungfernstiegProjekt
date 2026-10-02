// Abnahme M7 und M8 im Browser (16.2): Handy-Ansicht, gebauter Client, echter Server mit eigener Datenbank.
// Lokal: PW_CHROMIUM=/pfad/zu/chrome pnpm e2e (sonst der von Playwright installierte Chromium).
import { defineConfig, devices } from '@playwright/test';

export const E2E_PORT = 3459;

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(process.env['PW_CHROMIUM'] ? { executablePath: process.env['PW_CHROMIUM'] } : {}),
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [{ name: 'handy', use: { ...devices['Pixel 7'] } }],
  webServer: {
    // E2E_NODE: anderes Node für den Server, z. B. Node 22 wie auf dem Raspberry Pi 2 (OPEN-048)
    command: `${process.env['E2E_NODE'] ?? 'node'} e2e/server.mjs`,
    url: `http://localhost:${E2E_PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
