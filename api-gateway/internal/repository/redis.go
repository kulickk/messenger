package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisClient struct {
	client *redis.Client
}

func NewRedis(addr string) *RedisClient {
	return &RedisClient{
		client: redis.NewClient(&redis.Options{Addr: addr}),
	}
}

func (r *RedisClient) Close() error {
	return r.client.Close()
}

// SetSession stores the user's base64-encoded X25519 private key for the session.
func (r *RedisClient) SetSession(ctx context.Context, userID, privKeyB64 string) error {
	return r.client.Set(ctx, sessionKey(userID), privKeyB64, 24*time.Hour).Err()
}

// GetSession retrieves the user's private key from the session store.
func (r *RedisClient) GetSession(ctx context.Context, userID string) (string, error) {
	val, err := r.client.Get(ctx, sessionKey(userID)).Result()
	if err != nil {
		return "", fmt.Errorf("session not found for %s: %w", userID, err)
	}
	return val, nil
}

// DeleteSession removes the user session.
func (r *RedisClient) DeleteSession(ctx context.Context, userID string) error {
	return r.client.Del(ctx, sessionKey(userID)).Err()
}

func sessionKey(userID string) string { return "session:" + userID }
