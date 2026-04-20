const ZW_BIT0  = '\u200B'
const ZW_BIT1  = '\u200C'
const ZW_BOUND = '\u200D'

export function extract(text) {
  const start = text.indexOf(ZW_BOUND)
  if (start < 0) return null
  const rest = text.slice(start + 1)
  const end = rest.indexOf(ZW_BOUND)
  if (end < 0) return null
  const encoded = rest.slice(0, end)
  if (encoded.length % 8 !== 0) return null

  const result = new Uint8Array(encoded.length / 8)
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === ZW_BIT1) {
      result[Math.floor(i / 8)] |= 1 << (7 - (i % 8))
    }
  }
  return result
}

export function visiblePart(text) {
  const idx = text.indexOf(ZW_BOUND)
  return idx >= 0 ? text.slice(0, idx) : text
}
