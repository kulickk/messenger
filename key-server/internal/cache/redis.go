package cache

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

const keyTTL = time.Hour // pub_key:{user_id} TTL per C4 spec

type RedisCache struct {
	client *redis.Client
}

func NewRedisCache(addr string) *RedisCache {
	return &RedisCache{
		client: redis.NewClient(&redis.Options{Addr: addr}),
	}
}

func (c *RedisCache) Get(ctx context.Context, userID string) (string, error) {
	return c.client.Get(ctx, pubKeyKey(userID)).Result()
}

func (c *RedisCache) Set(ctx context.Context, userID, pubKey string) error {
	return c.client.Set(ctx, pubKeyKey(userID), pubKey, keyTTL).Err()
}

func (c *RedisCache) Delete(ctx context.Context, userID string) error {
	return c.client.Del(ctx, pubKeyKey(userID)).Err()
}

func pubKeyKey(userID string) string { return "pub_key:" + userID }
