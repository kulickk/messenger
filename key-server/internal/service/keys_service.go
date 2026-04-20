package service

import (
	"context"
	"fmt"

	"messenger/key-server/internal/cache"
	"messenger/key-server/internal/validator"
)

type KeysService struct {
	cache *cache.CacheLayer
}

func NewKeysService(c *cache.CacheLayer) *KeysService {
	return &KeysService{cache: c}
}

// Publish validates and stores the public key for a user.
func (s *KeysService) Publish(ctx context.Context, userID, pubKey string) error {
	if userID == "" {
		return fmt.Errorf("user_id is required")
	}
	if err := validator.ValidateX25519PublicKey(pubKey); err != nil {
		return fmt.Errorf("invalid public key: %w", err)
	}
	return s.cache.Set(ctx, userID, pubKey)
}

// Get retrieves the public key for a user (cache-aside via CacheLayer).
func (s *KeysService) Get(ctx context.Context, userID string) (string, error) {
	if userID == "" {
		return "", fmt.Errorf("user_id is required")
	}
	return s.cache.Get(ctx, userID)
}

// Revoke removes the public key for a user.
func (s *KeysService) Revoke(ctx context.Context, userID string) error {
	if userID == "" {
		return fmt.Errorf("user_id is required")
	}
	return s.cache.Delete(ctx, userID)
}
