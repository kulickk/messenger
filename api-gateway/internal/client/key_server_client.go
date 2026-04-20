package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type KeyServerClient struct {
	base   string
	http   *http.Client
}

// PublicKeyResponse is the response from GET /keys/{user_id}.
type PublicKeyResponse struct {
	UserID    string `json:"user_id"`
	PublicKey string `json:"public_key"` // base64-encoded X25519 raw public key
}

func NewKeyServerClient(baseURL string) *KeyServerClient {
	return &KeyServerClient{
		base: baseURL,
		http: &http.Client{Timeout: 5 * time.Second},
	}
}

// GetPublicKey fetches the X25519 public key for userID from the Key Server.
func (c *KeyServerClient) GetPublicKey(ctx context.Context, userID string) (*PublicKeyResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		fmt.Sprintf("%s/%s", c.base, userID), nil)
	if err != nil {
		return nil, fmt.Errorf("new request: %w", err)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("key server %d for user %s", resp.StatusCode, userID)
	}

	var result PublicKeyResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	return &result, nil
}
