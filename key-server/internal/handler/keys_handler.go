package handler

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"
	"messenger/key-server/internal/service"
)

type KeysHandler struct {
	svc *service.KeysService
}

func NewKeysHandler(svc *service.KeysService) *KeysHandler {
	return &KeysHandler{svc: svc}
}

// RegisterRoutes wires all endpoints into mux.
//
// Routes (per C4 component diagram):
//
//	POST   /publish       — store / update a public key
//	GET    /{user_id}     — fetch a public key
//	DELETE /revoke        — remove a public key
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func RegisterRoutes(mux *http.ServeMux, svc *service.KeysService) {
	h := NewKeysHandler(svc)
	mux.Handle("POST /publish",    corsMiddleware(http.HandlerFunc(h.publish)))
	mux.Handle("GET /{user_id}",   corsMiddleware(http.HandlerFunc(h.getKey)))
	mux.Handle("DELETE /revoke",   corsMiddleware(http.HandlerFunc(h.revoke)))
	mux.HandleFunc("OPTIONS /",    func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /health",  func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}

// publish handles POST /publish
//
// Body: {"user_id": "...", "public_key": "<base64 X25519>"}
func (h *KeysHandler) publish(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID    string `json:"user_id"`
		PublicKey string `json:"public_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	if err := h.svc.Publish(r.Context(), req.UserID, req.PublicKey); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

// getKey handles GET /{user_id}
func (h *KeysHandler) getKey(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")

	pubKey, err := h.svc.Get(r.Context(), userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		log.Printf("get key %s: %v", userID, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{ //nolint:errcheck
		"user_id":    userID,
		"public_key": pubKey,
	})
}

// revoke handles DELETE /revoke
//
// Body: {"user_id": "..."}
func (h *KeysHandler) revoke(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID string `json:"user_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}

	if err := h.svc.Revoke(r.Context(), req.UserID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
