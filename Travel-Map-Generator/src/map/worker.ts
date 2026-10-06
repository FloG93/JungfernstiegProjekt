import { setWorkerUrl } from 'maplibre-gl'
// Vite liefert die Datei als eigenes Asset aus und gibt uns ihre URL.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

/**
 * MapLibre lädt seinen Web-Worker normalerweise über `import.meta.url` als
 * Nachbardatei von `maplibre-gl.mjs`. Nach dem Bündeln liegt dort aber nur noch
 * unser eigener Chunk – der Worker fehlt, und die Karte bleibt leer
 * ("Worker failed to load. Check that the worker URL is correct.").
 *
 * Darum sagen wir MapLibre die URL ausdrücklich. Die Datei ist in sich
 * geschlossen und hat keine weiteren Importe, deshalb genügt `?url`.
 *
 * Muss einmal vor dem ersten `new MapLibreMap(...)` laufen.
 */
export function configureMapLibreWorker(): void {
  setWorkerUrl(maplibreWorkerUrl)
}
