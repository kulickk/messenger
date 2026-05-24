package ollama

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"messenger/mask-generator/internal/builder"
)

const (
	defaultModel      = "llama3.2"
	defaultTemp       = 0.85
	defaultNumPredict = 120
)

// Generator is the interface both the real Ollama client and the mock implement.
type Generator interface {
	Generate(ctx context.Context, p builder.Prompt) (string, error)
	// IsMock returns true for stub implementations that don't need a DB-loaded prompt.
	IsMock() bool
}

// Client sends inference requests to a local Ollama instance.
type Client struct {
	baseURL    string
	model      string
	httpClient *http.Client
}

func NewClient(baseURL, model string) *Client {
	if model == "" {
		model = defaultModel
	}
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		model:      model,
		httpClient: &http.Client{Timeout: 120 * time.Second},
	}
}

type generateRequest struct {
	Model   string         `json:"model"`
	Prompt  string         `json:"prompt"`
	System  string         `json:"system"`
	Stream  bool           `json:"stream"`
	Options generateOptions `json:"options"`
}

type generateOptions struct {
	Temperature float64 `json:"temperature"`
	NumPredict  int     `json:"num_predict"`
}

type generateResponse struct {
	Response string `json:"response"`
}

// Generate sends the prompt to Ollama and returns the raw generated text.
func (c *Client) Generate(ctx context.Context, p builder.Prompt) (string, error) {
	payload := generateRequest{
		Model:  c.model,
		Prompt: p.User,
		System: p.System,
		Stream: false,
		Options: generateOptions{
			Temperature: defaultTemp,
			NumPredict:  defaultNumPredict,
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/api/generate", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("ollama request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("ollama returned %d", resp.StatusCode)
	}

	var result generateResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	return strings.TrimSpace(result.Response), nil
}

func (c *Client) IsMock() bool { return false }
