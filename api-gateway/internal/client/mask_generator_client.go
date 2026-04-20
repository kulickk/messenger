package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type MaskGeneratorClient struct {
	base string
	http *http.Client
}

type maskRequest struct {
	Text     string `json:"text"`
	CipherID string `json:"cipher_id"`
}

// MaskResponse is the response from POST /generate-mask.
type MaskResponse struct {
	Mask string `json:"mask"`
}

func NewMaskGeneratorClient(baseURL string) *MaskGeneratorClient {
	return &MaskGeneratorClient{
		base: baseURL,
		http: &http.Client{Timeout: 15 * time.Second}, // LLM inference can be slow
	}
}

// GenerateMask requests a natural-language mask phrase for the given message.
func (c *MaskGeneratorClient) GenerateMask(ctx context.Context, text, cipherID string) (string, error) {
	body, err := json.Marshal(maskRequest{Text: text, CipherID: cipherID})
	if err != nil {
		return "", fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.base+"/generate-mask", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("do: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("mask generator %d", resp.StatusCode)
	}

	var result MaskResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode: %w", err)
	}
	return result.Mask, nil
}
