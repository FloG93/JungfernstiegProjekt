import { useEffect, useRef } from 'react'
import { MapLibreMap, NavigationControl, ScaleControl } from 'maplibre-gl'
import { configureMapLibreWorker } from './worker'
import type { MapStyleId } from './styles'
import { getStyle } from './styles'

configureMapLibreWorker()

interface MapViewProps {
  styleId: MapStyleId
}

/**
 * Die Karte selbst. Noch ohne Route und Animation – das kommt in M1 bis M3.
 *
 * `preserveDrawingBuffer` ist von Anfang an gesetzt: ohne das Flag liefert
 * `canvas.toBlob()` später beim Video-Export ein leeres Bild, und das Flag
 * lässt sich nachträglich nicht umstellen.
 */
export function MapView({ styleId }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const map = new MapLibreMap({
      container,
      style: getStyle(styleId).url,
      center: [13.405, 52.52], // Berlin – Startpunkt des Beispielprojekts
      zoom: 9,
      pitch: 0,
      bearing: 0,
      attributionControl: { compact: false },
      canvasContextAttributes: { preserveDrawingBuffer: true },
    })
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    mapRef.current = map

    return () => {
      mapRef.current = null
      map.remove()
    }
    // Absichtlich nur beim Aufbau: Stilwechsel läuft über setStyle, damit
    // später Route und Medien nicht bei jedem Wechsel neu aufgebaut werden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    mapRef.current?.setStyle(getStyle(styleId).url)
  }, [styleId])

  return <div ref={containerRef} className="h-full w-full" />
}
