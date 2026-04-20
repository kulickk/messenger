package cache

import (
	"context"
	"errors"
	"fmt"

	"github.com/redis/go-redis/v9"
	"messenger/key-server/internal/repository"
)

// CacheLayer implements the cache-aside pattern from the C4 component diagram:
//
//	Redis hit  → return cached value
//	Redis miss → fetch from DB → populate Redis → return
type CacheLayer struct {
	redis *RedisCache
	repo  *repository.KeysRepository
}

func NewCacheLayer(redis *RedisCache, repo *repository.KeysRepository) *CacheLayer {
	return &CacheLayer{redis: redis, repo: repo}
}

// Get reads from Redis; on a miss falls back to PostgreSQL and repopulates the cache.
func (c *CacheLayer) Get(ctx context.Context, userID string) (string, error) {
	pubKey, err := c.redis.Get(ctx, userID)
	if err == nil {
		return pubKey, nil // cache hit
	}
	if !errors.Is(err, redis.Nil) {
		return "", fmt.Errorf("redis get: %w", err)
	}

	// Cache miss — go to DB
	pubKey, err = c.repo.Get(ctx, userID)
	if err != nil {
		return "", err
	}

	// Populate cache (best-effort)
	_ = c.redis.Set(ctx, userID, pubKey)
	return pubKey, nil
}

// Set persists to PostgreSQL and writes through to Redis.
func (c *CacheLayer) Set(ctx context.Context, userID, pubKey string) error {
	if err := c.repo.Upsert(ctx, userID, pubKey); err != nil {
		return err
	}
	return c.redis.Set(ctx, userID, pubKey)
}

// Delete removes from PostgreSQL and invalidates the Redis entry.
func (c *CacheLayer) Delete(ctx context.Context, userID string) error {
	if err := c.repo.Delete(ctx, userID); err != nil {
		return err
	}
	return c.redis.Delete(ctx, userID)
}
