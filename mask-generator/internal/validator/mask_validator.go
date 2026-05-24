package validator

import (
	"fmt"
	"strings"
	"unicode/utf8"
)

const (
	minLen     = 10
	maxLen     = 300
	MaxRetries = 3
)

var noisePrefixes = []string{
	"Output:", "output:", "OUTPUT:",
	"Result:", "result:",
	"Response:", "response:",
	"Answer:", "answer:",
	"Mask:", "mask:",
}

// Validate checks that the mask phrase meets the length constraints.
// Returns a cleaned (trimmed) mask on success, or an error describing the violation.
func Validate(mask string) (string, error) {
	mask = strings.TrimSpace(mask)
	for _, p := range noisePrefixes {
		if strings.HasPrefix(mask, p) {
			mask = strings.TrimSpace(mask[len(p):])
			break
		}
	}
	mask = strings.TrimSpace(mask)
	n := utf8.RuneCountInString(mask)

	switch {
	case n < minLen:
		return "", fmt.Errorf("mask too short: %d runes (min %d)", n, minLen)
	case n > maxLen:
		return "", fmt.Errorf("mask too long: %d runes (max %d)", n, maxLen)
	}

	return mask, nil
}
