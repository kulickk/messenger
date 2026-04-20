package service

import (
	"context"
	"fmt"
	"log"

	"messenger/api-gateway/internal/client"
	"messenger/api-gateway/internal/repository"
)

type MessageService struct {
	keyClient  *client.KeyServerClient
	maskClient *client.MaskGeneratorClient
	cryptoSvc  *CryptoService
	db         *repository.Postgres
	rdb        *repository.RedisClient
}

func NewMessageService(
	keyClient *client.KeyServerClient,
	maskClient *client.MaskGeneratorClient,
	cryptoSvc *CryptoService,
	db *repository.Postgres,
	rdb *repository.RedisClient,
) *MessageService {
	return &MessageService{
		keyClient:  keyClient,
		maskClient: maskClient,
		cryptoSvc:  cryptoSvc,
		db:         db,
		rdb:        rdb,
	}
}

// Build builds the stego message without sending — returns it to the caller.
//  1. Fetch sender's private key from Redis session
//  2. GET /{toID} — fetch recipient's public key from Key Server
//  3. POST /generate-mask — get natural-language mask from Mask Generator
//  4. ECDH shared key + AES-256-GCM encrypt
//  5. Embed ciphertext as zero-width Unicode after mask
//  6. Persist record in PostgreSQL
//  → Return stego string to client; client sends via Telethon
func (s *MessageService) Build(ctx context.Context, fromID, toID, text, cipherID string) (string, error) {
	// 1. Sender's private key from session
	privKeyB64, err := s.rdb.GetSession(ctx, fromID)
	if err != nil {
		return "", fmt.Errorf("get session for %s: %w", fromID, err)
	}

	// 2. Recipient's public key
	pubKeyResp, err := s.keyClient.GetPublicKey(ctx, toID)
	if err != nil {
		return "", fmt.Errorf("get public key for %s: %w", toID, err)
	}

	// 3. Mask phrase
	mask, err := s.maskClient.GenerateMask(ctx, text, cipherID)
	if err != nil {
		return "", fmt.Errorf("generate mask: %w", err)
	}

	// 4–5. Encrypt + stego embed
	stegoMsg, err := s.cryptoSvc.BuildStegoMessage(privKeyB64, pubKeyResp.PublicKey, text, mask)
	if err != nil {
		return "", fmt.Errorf("build stego message: %w", err)
	}

	// 6. Persist (non-critical — log but don't fail)
	if err := s.db.SaveMessage(ctx, fromID, toID, stegoMsg); err != nil {
		log.Printf("warn: save message from=%s to=%s: %v", fromID, toID, err)
	}

	return stegoMsg, nil
}
