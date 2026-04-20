package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"messenger/mask-generator/internal/analyser"
	"messenger/mask-generator/internal/builder"
	"messenger/mask-generator/internal/loader"
	"messenger/mask-generator/internal/ollama"
	"messenger/mask-generator/internal/validator"
)

type MaskHandler struct {
	cipherLoader *loader.CipherLoader
	generator    ollama.Generator
}

func NewMaskHandler(cl *loader.CipherLoader, g ollama.Generator) *MaskHandler {
	return &MaskHandler{cipherLoader: cl, generator: g}
}

func RegisterRoutes(mux *http.ServeMux, cl *loader.CipherLoader, g ollama.Generator) {
	h := NewMaskHandler(cl, g)
	mux.HandleFunc("POST /generate-mask", h.generateMask)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

type generateMaskRequest struct {
	Text     string `json:"text"`
	CipherID string `json:"cipher_id"`
}

type generateMaskResponse struct {
	Mask string `json:"mask"`
}

// generateMask implements the full pipeline from the C4 component diagram:
//
//  1. Analyse message (tone, urgency, length, language)
//  2. Load cipher style (PostgreSQL + in-memory cache)
//  3. Build prompt (system: style+rules, user: original text)
//  4. Call Ollama (mistral, temp 0.85, num_predict 80)
//  5. Validate mask (10–300 chars) — retry up to 3 times
func (h *MaskHandler) generateMask(w http.ResponseWriter, r *http.Request) {
	var req generateMaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.Text == "" {
		http.Error(w, "text is required", http.StatusBadRequest)
		return
	}

	mask, err := h.run(r.Context(), req.Text, req.CipherID)
	if err != nil {
		log.Printf("generate mask: %v", err)
		http.Error(w, "failed to generate mask", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(generateMaskResponse{Mask: mask}) //nolint:errcheck
}

func (h *MaskHandler) run(ctx context.Context, text, cipherID string) (string, error) {
	// 1. Analyse
	analysis := analyser.Analyse(text)

	// 2+3. Load cipher + build prompt (skipped in mock mode — prompt is unused)
	var prompt builder.Prompt
	if !h.generator.IsMock() {
		var (
			cipher *loader.Cipher
			err    error
		)
		if cipherID == "" {
			cipher, err = h.cipherLoader.GetDefault(ctx)
		} else {
			cipher, err = h.cipherLoader.Get(ctx, cipherID)
		}
		if err != nil {
			return "", fmt.Errorf("load cipher: %w", err)
		}
		prompt = builder.Build(analysis, cipher, text)
	} else {
		// Pass cipher_id in System so MockClient can pick the right stub
		prompt = builder.Prompt{System: cipherID, User: text}
	}

	// 4 + 5. Generate and validate with retry
	for attempt := 1; attempt <= validator.MaxRetries; attempt++ {
		raw, err := h.generator.Generate(ctx, prompt)
		if err != nil {
			if attempt == validator.MaxRetries {
				return "", fmt.Errorf("ollama generate (attempt %d): %w", attempt, err)
			}
			log.Printf("ollama attempt %d failed: %v — retrying", attempt, err)
			continue
		}

		mask, err := validator.Validate(raw)
		if err != nil {
			if attempt == validator.MaxRetries {
				return "", fmt.Errorf("mask validation failed after %d attempts: %w", attempt, err)
			}
			log.Printf("mask validation attempt %d: %v — retrying", attempt, err)
			continue
		}

		return mask, nil
	}

	return "", fmt.Errorf("exhausted %d retries", validator.MaxRetries)
}
