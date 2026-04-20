package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type KeysRepository struct {
	pool *pgxpool.Pool
}

func NewKeysRepository(pool *pgxpool.Pool) *KeysRepository {
	return &KeysRepository{pool: pool}
}

// Upsert inserts a public key or updates it if the user_id already exists.
func (r *KeysRepository) Upsert(ctx context.Context, userID, publicKey string) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO public_keys (user_id, public_key, updated_at)
		 VALUES ($1, $2, NOW())
		 ON CONFLICT (user_id) DO UPDATE SET public_key = $2, updated_at = NOW()`,
		userID, publicKey,
	)
	if err != nil {
		return fmt.Errorf("upsert key for %s: %w", userID, err)
	}
	return nil
}

// Get returns the public key for a user. Returns pgx.ErrNoRows if not found.
func (r *KeysRepository) Get(ctx context.Context, userID string) (string, error) {
	var pubKey string
	err := r.pool.QueryRow(ctx,
		`SELECT public_key FROM public_keys WHERE user_id = $1`, userID,
	).Scan(&pubKey)
	if err != nil {
		return "", fmt.Errorf("get key for %s: %w", userID, err)
	}
	return pubKey, nil
}

// Delete removes the public key for a user.
func (r *KeysRepository) Delete(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM public_keys WHERE user_id = $1`, userID,
	)
	if err != nil {
		return fmt.Errorf("delete key for %s: %w", userID, err)
	}
	return nil
}
