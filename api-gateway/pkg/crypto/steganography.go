package crypto

import "strings"

// Zero-width Unicode characters used for bit-level steganography.
const (
	zwBit0  = "\u200B" // ZERO WIDTH SPACE       — bit 0
	zwBit1  = "\u200C" // ZERO WIDTH NON-JOINER  — bit 1
	zwBound = "\u200D" // ZERO WIDTH JOINER      — start / end marker
)

// Embed encodes data as zero-width characters (MSB first) and appends them
// after mask. The resulting string looks like plain text to any observer.
func Embed(mask string, data []byte) string {
	var b strings.Builder
	b.WriteString(mask)
	b.WriteString(zwBound)
	for _, byteVal := range data {
		for i := 7; i >= 0; i-- {
			if (byteVal>>uint(i))&1 == 1 {
				b.WriteString(zwBit1)
			} else {
				b.WriteString(zwBit0)
			}
		}
	}
	b.WriteString(zwBound)
	return b.String()
}

// Extract parses the zero-width payload from a stego string and returns the
// original bytes. Returns nil if no valid payload is found.
func Extract(text string) []byte {
	start := strings.Index(text, zwBound)
	if start < 0 {
		return nil
	}
	rest := text[start+len(zwBound):]

	end := strings.Index(rest, zwBound)
	if end < 0 {
		return nil
	}
	encoded := rest[:end]

	runes := []rune(encoded)
	if len(runes)%8 != 0 {
		return nil
	}

	result := make([]byte, len(runes)/8)
	for i, r := range runes {
		if string(r) == zwBit1 {
			byteIdx := i / 8
			bitIdx := 7 - (i % 8)
			result[byteIdx] |= 1 << uint(bitIdx)
		}
	}
	return result
}
