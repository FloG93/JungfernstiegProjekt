import { describe, expect, it } from 'vitest'
import { DEFAULT_STYLE_ID, MAP_STYLES, getStyle } from '../src/map/styles'

describe('Kartenstil-Registry', () => {
  it('hat eindeutige Kennungen', () => {
    const ids = MAP_STYLES.map((style) => style.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('liefert jeden Stil über getStyle', () => {
    for (const style of MAP_STYLES) {
      expect(getStyle(style.id)).toBe(style)
    }
  })

  it('wirft bei unbekannter Kennung statt still etwas Falsches zu laden', () => {
    // @ts-expect-error – absichtlich ungültige Kennung
    expect(() => getStyle('gibt-es-nicht')).toThrow(/Unbekannter Kartenstil/)
  })

  it('der Standardstil existiert und braucht keinen Key', () => {
    const style = getStyle(DEFAULT_STYLE_ID)
    expect(style.needsKey).toBe(false)
  })

  it('jeder keylose Stil hat eine absolute https-URL', () => {
    for (const style of MAP_STYLES.filter((candidate) => !candidate.needsKey)) {
      expect(style.url).toMatch(/^https:\/\//)
      // Platzhalter wie {key} dürfen in keylosen Stilen nicht vorkommen.
      expect(style.url).not.toMatch(/\{.*\}/)
    }
  })
})
