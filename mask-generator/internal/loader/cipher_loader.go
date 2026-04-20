package loader

import (
	"context"
	"fmt"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Cipher holds a writing-style definition used to build LLM prompts.
type Cipher struct {
	ID    string
	Name  string
	Style string // short description of the writing style
	Rules string // concrete rules injected into the system prompt
}

// CipherLoader fetches cipher styles from PostgreSQL with an in-memory cache.
// The cache is populated on first access per cipher_id and never evicted
// (cipher rows are static seed data).
type CipherLoader struct {
	pool  *pgxpool.Pool
	mu    sync.RWMutex
	cache map[string]*Cipher
}

func NewCipherLoader(pool *pgxpool.Pool) *CipherLoader {
	return &CipherLoader{
		pool:  pool,
		cache: make(map[string]*Cipher),
	}
}

// Get returns the Cipher for the given id, hitting the in-memory cache first.
// Falls back to PostgreSQL on a cache miss.
func (l *CipherLoader) Get(ctx context.Context, cipherID string) (*Cipher, error) {
	// Fast path — read lock
	l.mu.RLock()
	if c, ok := l.cache[cipherID]; ok {
		l.mu.RUnlock()
		return c, nil
	}
	l.mu.RUnlock()

	// Slow path — fetch from DB
	c, err := l.fetchFromDB(ctx, cipherID)
	if err != nil {
		return nil, err
	}

	// Populate cache
	l.mu.Lock()
	l.cache[cipherID] = c
	l.mu.Unlock()

	return c, nil
}

// GetDefault returns the first available cipher (used when cipher_id is empty).
func (l *CipherLoader) GetDefault(ctx context.Context) (*Cipher, error) {
	var c Cipher
	err := l.pool.QueryRow(ctx,
		`SELECT id, name, style, rules FROM ciphers ORDER BY id LIMIT 1`,
	).Scan(&c.ID, &c.Name, &c.Style, &c.Rules)
	if err != nil {
		return nil, fmt.Errorf("get default cipher: %w", err)
	}
	return &c, nil
}

func (l *CipherLoader) fetchFromDB(ctx context.Context, cipherID string) (*Cipher, error) {
	var c Cipher
	err := l.pool.QueryRow(ctx,
		`SELECT id, name, style, rules FROM ciphers WHERE id = $1`, cipherID,
	).Scan(&c.ID, &c.Name, &c.Style, &c.Rules)
	if err != nil {
		return nil, fmt.Errorf("fetch cipher %s: %w", cipherID, err)
	}
	return &c, nil
}
