package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Postgres struct {
	pool *pgxpool.Pool
}

func NewPostgres(ctx context.Context, dsn string) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("pgxpool.New: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}
	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Close() {
	p.pool.Close()
}

// SaveMessage persists an outbound encrypted message record.
func (p *Postgres) SaveMessage(ctx context.Context, fromID, toID, ciphertext string) error {
	_, err := p.pool.Exec(ctx,
		`INSERT INTO messages (from_user_id, to_user_id, ciphertext, created_at)
		 VALUES ($1, $2, $3, NOW())`,
		fromID, toID, ciphertext,
	)
	return err
}

// UserExists returns true if the user is registered.
func (p *Postgres) UserExists(ctx context.Context, userID string) (bool, error) {
	var exists bool
	err := p.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, userID,
	).Scan(&exists)
	return exists, err
}

// InboxMessage is a single row returned by GetInbox.
type InboxMessage struct {
	ID         int64  `json:"id"`
	FromUserID string `json:"from_user_id"`
	Stego      string `json:"stego"`
}

// GetInbox returns up to 50 messages addressed to userID with id > afterID.
func (p *Postgres) GetInbox(ctx context.Context, userID string, afterID int64) ([]InboxMessage, error) {
	rows, err := p.pool.Query(ctx,
		`SELECT id, from_user_id, ciphertext
		   FROM messages
		  WHERE to_user_id = $1 AND id > $2
		  ORDER BY id ASC
		  LIMIT 50`,
		userID, afterID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []InboxMessage
	for rows.Next() {
		var m InboxMessage
		if err := rows.Scan(&m.ID, &m.FromUserID, &m.Stego); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, rows.Err()
}
