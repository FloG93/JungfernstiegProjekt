// Ablauf eines neuen Projekts im Browser: Datei öffnen (Upload-Fallback), Ausschnitt per
// Tastenkürzel setzen, transkribieren (Fortschritt über WebSocket), Noten prüfen.
//
// Aufruf:  node e2e/new-project.mjs <audiodatei> [http://127.0.0.1:8765]

import { chromium } from "playwright";

const file = process.argv[2];
const base = process.argv[3] ?? "http://127.0.0.1:8765";
if (!file) throw new Error("Audiodatei angeben");
const shots = new URL("./", import.meta.url).pathname;

function check(condition, message) {
  if (!condition) throw new Error(`FEHLER: ${message}`);
  console.log(`✔ ${message}`);
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? undefined });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

try {
  await page.goto(base);
  await page.locator(".app-header .device").waitFor();
  const setup = page.getByRole("dialog", { name: "Einrichtung" });
  await page.waitForTimeout(300);
  if (await setup.isVisible()) await setup.getByRole("button", { name: "Fertig" }).click();

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Neues Projekt/ }).click();
  await (await chooser).setFiles(file);
  await page.locator(".waveform-panel").waitFor({ timeout: 60000 });
  check(true, "Projekt angelegt, Editor geöffnet");

  // Ausschnitt: Abspielkopf per Klick auf die Wellenform setzen, dann „]“ für das Ende.
  const wave = page.locator(".waveform");
  const box = await wave.boundingBox();
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.waitForTimeout(300);
  await page.keyboard.press("]");
  await page.waitForTimeout(1200);
  const trimText = await page.locator(".trim-display").innerText();
  check(!trimText.includes("0:25,5 ("), `Ausschnitt per Tastenkürzel gesetzt (${trimText})`);

  await page.getByRole("button", { name: "Transkribieren" }).click();
  await page.locator(".stage-running").first().waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${shots}04-running.png` });
  check(true, "Fortschritt pro Stufe wird angezeigt");
  await page.getByRole("button", { name: "Noten sind aktuell" }).waitFor({ timeout: 300000 });
  await page.locator(".score-svg > svg").waitFor({ timeout: 30000 });
  const notes = await page.locator(".score-svg g.note").count();
  check(notes > 20, `Noten erzeugt (${notes} Noten)`);
  check(await page.locator(".stage-done").count() >= 4, "Alle Stufen fertig");
  await page.screenshot({ path: `${shots}05-done.png` });
  check(errors.length === 0, `keine Seitenfehler ${errors.length ? JSON.stringify(errors) : ""}`);
} finally {
  await browser.close();
}
