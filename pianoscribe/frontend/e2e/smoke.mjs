// Rauchtest im Browser: Startseite → Projekt öffnen → Noten sichtbar → Wiedergabe mit
// mitlaufender Hervorhebung → Parameter ändern → PDF-Export.
//
// Voraussetzung: gebautes Frontend (npm run build) und laufendes Backend mit mindestens einem
// transkribierten Projekt:  uv run pianoscribe serve --dev --port 8765
// Aufruf:  node e2e/smoke.mjs [http://127.0.0.1:8765] [Projektname]

import { chromium } from "playwright";

const base = process.argv[2] ?? "http://127.0.0.1:8765";
const projectName = process.argv[3] ?? "Demo Klavier";
const executablePath = process.env.PW_CHROMIUM ?? undefined;
const shots = new URL("./", import.meta.url).pathname;

function check(condition, message) {
  if (!condition) throw new Error(`FEHLER: ${message}`);
  console.log(`✔ ${message}`);
}

const browser = await chromium.launch({
  executablePath,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

try {
  await page.goto(base);
  await page.getByRole("heading", { name: "Projekte" }).waitFor();
  await page.locator(".app-header .device").waitFor(); // Health geladen
  await page.waitForTimeout(300);
  const setup = page.getByRole("dialog", { name: "Einrichtung" });
  if (await setup.isVisible()) {
    check(await setup.locator(".model-list li").count() === 3, "Einrichtungsdialog listet die Modelle");
    await page.screenshot({ path: `${shots}00-setup.png` });
    await setup.getByRole("button", { name: "Fertig" }).click();
    await setup.waitFor({ state: "detached" });
  }
  check(await page.locator(".project-card").count() > 0, "Projektliste wird angezeigt");
  await page.screenshot({ path: `${shots}01-start.png` });

  await page.locator(".project-open", { hasText: projectName }).first().click();
  await page.locator(".waveform").waitFor();
  await page.locator(".score-svg > svg").waitFor({ timeout: 30000 });
  check(await page.locator(".score-svg g.note").count() > 20, "Noten werden mit Verovio gesetzt");
  check(await page.locator(".waveform").evaluate((el) => el.shadowRoot !== null || el.children.length > 0),
    "Wellenform ist aufgebaut");
  check(await page.locator(".detected").innerText().then((t) => t.includes("BPM")), "Erkannte Werte werden angezeigt");
  await page.screenshot({ path: `${shots}02-editor.png` });

  // Wiedergabe: Noten (synthetisiert) → Hervorhebung läuft mit.
  const play = page.locator(".player-bar .play");
  await play.waitFor();
  await page.waitForFunction(() => !document.querySelector(".player-bar .play")?.hasAttribute("disabled"),
    null, { timeout: 30000 });
  await page.locator(".player-bar .segmented button", { hasText: "Noten" }).click();
  await play.click();
  await page.waitForTimeout(3500);
  const highlighted = await page.locator(".score-svg .ps-playing").count();
  check(highlighted > 0, `Mitlaufende Hervorhebung (${highlighted} Elemente)`);
  const position = await page.locator(".player-bar .time-display").first().innerText();
  check(position !== "0:00,0", `Wiedergabeposition läuft (${position})`);
  await page.screenshot({ path: `${shots}03-playing.png` });
  await play.click();

  // Parameter live ändern: Raster auf Achtel.
  const before = await page.locator(".score-svg").innerHTML();
  await page.locator("#grid").selectOption("1/8");
  await page.waitForFunction((old) => document.querySelector(".score-svg")?.innerHTML !== old, before,
    { timeout: 15000 });
  check(true, "Parameteränderung setzt die Noten neu");
  await page.locator("#grid").selectOption("auto");
  await page.waitForTimeout(1500);

  // PDF-Export (Browser-Fallback: Download).
  const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
  await page.locator(".export-panel button", { hasText: "PDF" }).click();
  const download = await downloadPromise;
  const pdfPath = `${shots}export.pdf`;
  await download.saveAs(pdfPath);
  const fs = await import("node:fs");
  const bytes = fs.readFileSync(pdfPath);
  check(bytes.subarray(0, 5).toString() === "%PDF-" && bytes.length > 5000, `PDF erzeugt (${bytes.length} Bytes)`);

  const relevant = errors.filter((e) => !e.includes("AudioContext") && !e.includes("favicon"));
  check(relevant.length === 0, `keine Fehler in der Konsole ${relevant.length ? JSON.stringify(relevant) : ""}`);
} finally {
  await browser.close();
}
