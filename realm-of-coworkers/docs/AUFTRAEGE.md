# Auftragsvorlagen für Claude Code

Je Sitzung ein Meilenstein (16.2). Vorlage aus 17.3, hier je Meilenstein ausgefüllt.
Vor dem Absenden prüfen, ob `docs/PROGRESS.md` den vorherigen Meilenstein als erledigt führt.

## M0 Gerüst

```text
Lies CLAUDE.md, docs/PROGRESS.md und docs/spec/16-umsetzung.md.
Setze Meilenstein M0 um. Relevante Abschnitte: docs/spec/02-technik.md.
Grundgerüst, CI, package.json, pnpm-workspace.yaml und .env.example liegen bereits vor.
Ergänze: TypeScript strict, ESLint mit no-magic-numbers für packages/shared/src/sim,
Vitest, Dockerfile und docker compose nach 16.6, leere Pakete apps/client, apps/server,
packages/shared, packages/content (Daten sind vorhanden) und tools/balance.
Abnahme: pnpm install, pnpm lint, pnpm typecheck, pnpm test und pnpm content:check laufen grün.
Trage Unklarheiten in docs/OPEN.md ein, statt zu raten. Aktualisiere docs/PROGRESS.md.
```

## M1 Shared-Kern

```text
Lies CLAUDE.md, docs/PROGRESS.md und docs/spec/16-umsetzung.md.
Setze Meilenstein M1 um. Relevante Abschnitte: docs/spec/05-werte.md, docs/spec/15-datenmodell.md
und docs/spec/13-balancing.md.
packages/content ist vollständig und geprüft (17.5). Erzeuge die Daten nicht neu.
Baue: Zod-Schemas für alle Dateien aus 15.5, den Content-Loader mit den Prüfungen aus 15.5,
die Formeln aus Abschnitt 5, die Werteberechnung aus Items, Gems, Artefakten und Verzauberung
sowie den Zufallszähler mulberry32.
Abnahme: Rechenbeispiele aus 5.3 (219,0 Punkte) und 5.6 (38 % Mitigation) sowie die
Referenzwerte aus 13.3 stimmen; der Loader lehnt eine absichtlich fehlerhafte Datei ab.
Schreibe zuerst die Tests, dann die Umsetzung. Aktualisiere docs/PROGRESS.md.
```

## M2 Kampfsimulation

```text
Lies CLAUDE.md, docs/PROGRESS.md und docs/spec/16-umsetzung.md.
Setze Meilenstein M2 um. Relevante Abschnitte: docs/spec/04-klassen.md, docs/spec/06-kampf.md
und docs/spec/15-datenmodell.md.
Baue die kopflose, deterministische Simulation: Entitäten, Effekt-Schema, Handler (je Handler
eine Datei und ein Test), Statuseffekte, Bedrohung, Telegraphen und Auto-Cast-Regeln.
Abnahme: je Fähigkeit ein Test; das gemessene K jeder Klasse weicht höchstens 10 % von 13.2 ab
(Schurke laut 13.2 einschließlich Blutdurst, Meucheln-Bonus und Tarnung, Zielwert 1,62);
gleicher Seed liefert gleiche Ereignisse.
Aktualisiere docs/PROGRESS.md und trage die gemessenen K-Werte dort ein.
```

## M3 bis M12

Gleiche Vorlage, Abschnitte nach 16.2:

| Meilenstein | Abschnitte |
| --- | --- |
| M3 Gegner, Stages, Autowalk | 09-level, 06-kampf, 15-datenmodell |
| M4 Bosse | 10-bosse, 06-kampf, 13-balancing |
| M5 Persistenz und HTTP | 15-datenmodell, 08-ausruestung, 07-gems-artefakte |
| M6 Beute und Fortschritt | 12-progression, 10-bosse, 13-balancing |
| M7 Client-Grundlage | 14-oberflaeche, 11-multiplayer, 02-technik |
| M8 Lager und Menüs | 14-oberflaeche, 03-welt, 07-gems-artefakte, 08-ausruestung |
| M9 Mehrspieler | 11-multiplayer, 15-datenmodell |
| M10 pnpm balance | 13-balancing, anhang-a-referenzmodell |
| M11 Politur | 14-oberflaeche |
| M12 Härtung und Betrieb | 02-technik, 11-multiplayer, 16-umsetzung |
