package service

import (
	"encoding/base64"
	"fmt"

	"messenger/api-gateway/pkg/crypto"
)

type CryptoService struct{}

func NewCryptoService() *CryptoService { return &CryptoService{} }

// BuildStegoMessage orchestrates the full crypto pipeline for a single outbound message:
//  1. Decode sender's X25519 private key (base64)
//  2. Decode recipient's X25519 public key (base64)
//  3. Compute ECDH shared secret
//  4. Encrypt plaintext with AES-256-GCM
//  5. Embed ciphertext as zero-width chars after the mask phrase
func (s *CryptoService) BuildStegoMessage(privKeyB64, pubKeyB64, plaintext, mask string) (string, error) {
	privKey, err := crypto.PrivateKeyFromBase64(privKeyB64)
	if err != nil {
		return "", fmt.Errorf("decode private key: %w", err)
	}

	pubKeyBytes, err := base64.StdEncoding.DecodeString(pubKeyB64)
	if err != nil {
		return "", fmt.Errorf("decode public key: %w", err)
	}

	sharedSecret, err := crypto.SharedKey(privKey, pubKeyBytes)
	if err != nil {
		return "", fmt.Errorf("ecdh: %w", err)
	}

	ciphertext, err := crypto.Encrypt(sharedSecret, []byte(plaintext))
	if err != nil {
		return "", fmt.Errorf("aes encrypt: %w", err)
	}

	return crypto.Embed(mask, ciphertext), nil
}
