package crypto

import (
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"fmt"
)

// GenerateKeyPair generates an X25519 key pair.
func GenerateKeyPair() (*ecdh.PrivateKey, error) {
	return ecdh.X25519().GenerateKey(rand.Reader)
}

// SharedKey computes the ECDH shared secret from a local private key and a remote raw public key.
func SharedKey(privKey *ecdh.PrivateKey, remotePubKeyBytes []byte) ([]byte, error) {
	remotePub, err := ecdh.X25519().NewPublicKey(remotePubKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("parse remote pub key: %w", err)
	}
	return privKey.ECDH(remotePub)
}

// PrivateKeyFromBase64 decodes a base64-encoded raw X25519 private key (32 bytes).
func PrivateKeyFromBase64(s string) (*ecdh.PrivateKey, error) {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("base64 decode: %w", err)
	}
	return ecdh.X25519().NewPrivateKey(b)
}

// PublicKeyFromBase64 decodes a base64-encoded raw X25519 public key (32 bytes).
func PublicKeyFromBase64(s string) (*ecdh.PublicKey, error) {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return nil, fmt.Errorf("base64 decode: %w", err)
	}
	return ecdh.X25519().NewPublicKey(b)
}
