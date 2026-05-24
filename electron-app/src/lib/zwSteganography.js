// Encode arbitrary text as invisible zero-width Unicode characters.
// U+200B (ZWS) = bit 0, U+200C (ZWNJ) = bit 1, U+200D (ZWJ) = byte separator.
// These characters are visually invisible and pass through Telegram unchanged.

const B0  = '\u200B'  // bit 0
const B1  = '\u200C'  // bit 1
const SEP = '\u200D'  // byte separator
const ZW_RE = /[\u200B\u200C\u200D]+/

export function zwEncode(str) {
    const bytes = new TextEncoder().encode(str)
    return Array.from(bytes)
        .map(byte =>
            Array.from({ length: 8 }, (_, i) => ((byte >> (7 - i)) & 1) ? B1 : B0).join('')
        )
        .join(SEP)
}

export function zwDecode(text) {
    const zwOnly = Array.from(text).filter(c => c === B0 || c === B1 || c === SEP)
    if (zwOnly.length === 0) return null
    const bits = zwOnly.filter(c => c !== SEP).map(c => c === B1 ? 1 : 0)
    if (bits.length % 8 !== 0) return null
    const bytes = new Uint8Array(bits.length / 8)
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = bits.slice(i * 8, i * 8 + 8).reduce((acc, b, j) => acc | (b << (7 - j)), 0)
    }
    try { return new TextDecoder().decode(bytes) } catch { return null }
}

// Returns true if text contains hidden zero-width payload
export function hasZwPayload(text) {
    return ZW_RE.test(text)
}

// Strip all zero-width characters (to get the visible part only)
export function visibleText(text) {
    return text.replace(/[\u200B\u200C\u200D]/g, '')
}
