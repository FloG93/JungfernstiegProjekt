import { describe, expect, it } from 'vitest'
import type { CapabilityProbe } from '../src/export/capabilities'
import { evaluateCapabilities } from '../src/export/capabilities'

const base: CapabilityProbe = {
  hasVideoEncoder: false,
  isCrossOriginIsolated: false,
  hasOffscreenCanvas: false,
  hasFileSystemAccess: false,
}

describe('evaluateCapabilities', () => {
  it('nimmt WebCodecs, sobald es da ist', () => {
    const report = evaluateCapabilities({ ...base, hasVideoEncoder: true })
    expect(report.path).toBe('webcodecs')
  })

  it('bevorzugt WebCodecs auch ohne Cross-Origin-Isolation', () => {
    // Genau der Fall auf GitHub Pages: keine COOP/COEP-Header, aber WebCodecs.
    const report = evaluateCapabilities({
      ...base,
      hasVideoEncoder: true,
      isCrossOriginIsolated: false,
    })
    expect(report.path).toBe('webcodecs')
  })

  it('fällt ohne WebCodecs auf mehrkerniges ffmpeg zurück, wenn isoliert', () => {
    const report = evaluateCapabilities({ ...base, isCrossOriginIsolated: true })
    expect(report.path).toBe('ffmpeg-wasm-mt')
  })

  it('bleibt im langsamen Pfad, wenn nichts davon verfügbar ist', () => {
    const report = evaluateCapabilities(base)
    expect(report.path).toBe('ffmpeg-wasm-st')
    expect(report.note).toContain('PNG-Sequenz')
  })

  it('bietet die PNG-Sequenz immer an', () => {
    for (const videoEncoder of [false, true]) {
      for (const isolated of [false, true]) {
        const report = evaluateCapabilities({
          ...base,
          hasVideoEncoder: videoEncoder,
          isCrossOriginIsolated: isolated,
        })
        expect(report.alphaPaths).toContain('png-sequence')
      }
    }
  })

  it('bietet ProRes nur bei Cross-Origin-Isolation an', () => {
    expect(evaluateCapabilities(base).alphaPaths).not.toContain('prores')
    expect(
      evaluateCapabilities({ ...base, isCrossOriginIsolated: true }).alphaPaths,
    ).toContain('prores')
  })

  it('bietet WebM mit Alpha nur mit WebCodecs an', () => {
    expect(evaluateCapabilities(base).alphaPaths).not.toContain('webm-alpha')
    expect(
      evaluateCapabilities({ ...base, hasVideoEncoder: true }).alphaPaths,
    ).toContain('webm-alpha')
  })

  it('meldet Datei-Streaming nur, wenn der Picker existiert', () => {
    expect(evaluateCapabilities(base).canStreamToDisk).toBe(false)
    expect(
      evaluateCapabilities({ ...base, hasFileSystemAccess: true }).canStreamToDisk,
    ).toBe(true)
  })
})
