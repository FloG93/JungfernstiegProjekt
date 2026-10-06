import { useMemo, useState } from 'react'
import { MapView } from '../map/MapView'
import type { MapStyleId } from '../map/styles'
import { DEFAULT_STYLE_ID, MAP_STYLES } from '../map/styles'
import { evaluateCapabilities, probeBrowser } from '../export/capabilities'

const ROADMAP = [
  { id: 'M1', text: 'Datenmodell, Projekt speichern, Punkte auf der Karte setzen' },
  { id: 'M2', text: 'Routing (Auto, Motorrad, Fahrrad, zu Fuß), Fluglinien, GPX-Import' },
  { id: 'M3', text: 'Animation der Linie, Fahrzeug-Marker, Kamerafahrt mit Keyframes' },
  { id: 'M4', text: 'Video-Export als vertikales MP4 (9:16) mit Musik' },
]

export function App() {
  const [styleId, setStyleId] = useState<MapStyleId>(DEFAULT_STYLE_ID)
  const capabilities = useMemo(() => evaluateCapabilities(probeBrowser()), [])

  return (
    <div className="flex h-dvh flex-col bg-slate-950 text-slate-100">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-800 px-4 py-3">
        <h1 className="text-base font-semibold tracking-tight">Travel-Map-Generator</h1>
        <span className="rounded bg-amber-400/15 px-2 py-0.5 text-xs text-amber-300">
          Meilenstein M0 – Gerüst
        </span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-slate-400">Kartenstil</span>
          <select
            value={styleId}
            onChange={(event) => setStyleId(event.target.value as MapStyleId)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          >
            {MAP_STYLES.map((style) => (
              <option key={style.id} value={style.id} disabled={style.needsKey}>
                {style.label}
                {style.needsKey ? ' (API-Key nötig)' : ''}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 space-y-4 border-slate-800 p-4 text-sm lg:w-80 lg:border-r">
          <section>
            <h2 className="mb-1 font-medium">Noch nichts zu tun</h2>
            <p className="text-slate-400">
              Das Gerüst steht: Karte, Build und Auslieferung über GitHub Pages
              laufen. Die eigentlichen Funktionen kommen in dieser Reihenfolge.
            </p>
          </section>
          <ol className="space-y-2">
            {ROADMAP.map((step) => (
              <li key={step.id} className="flex gap-2">
                <span className="mt-0.5 shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400">
                  {step.id}
                </span>
                <span className="text-slate-300">{step.text}</span>
              </li>
            ))}
          </ol>
          <section className="rounded border border-slate-800 bg-slate-900/60 p-3">
            <h2 className="mb-1 font-medium">Video-Export in diesem Browser</h2>
            <p className="text-slate-300">{capabilities.label}</p>
            <p className="mt-1 text-xs text-slate-400">{capabilities.note}</p>
          </section>
        </aside>

        <div className="min-h-80 flex-1">
          <MapView styleId={styleId} />
        </div>
      </main>
    </div>
  )
}
