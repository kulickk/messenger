package validator

import (
	"encoding/base64"
	"fmt"
)

// ValidateX25519PublicKey checks that s is a valid base64-encoded X25519 public key.
// X25519 raw public keys are exactly 32 bytes.
func ValidateX25519PublicKey(s string) error {
	if s == "" {
		return fmt.Errorf("public key is empty")
	}

	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return fmt.Errorf("base64 decode: %w", err)
	}

	if len(b) != 32 {
		return fmt.Errorf("invalid key length: expected 32 bytes, got %d", len(b))
	}

	return nil
}
