package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"messenger/api-gateway/internal/repository"
)

type InboxHandler struct {
	db *repository.Postgres
}

func NewInboxHandler(db *repository.Postgres) *InboxHandler {
	return &InboxHandler{db: db}
}

// GET /inbox/{user_id}?after=<last_seen_id>
// Returns up to 50 messages addressed to user_id with id > after (default 0).
func (h *InboxHandler) Handle(w http.ResponseWriter, r *http.Request) {
	userID := r.PathValue("user_id")
	if userID == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}

	var afterID int64
	if s := r.URL.Query().Get("after"); s != "" {
		v, err := strconv.ParseInt(s, 10, 64)
		if err != nil {
			http.Error(w, "after must be an integer", http.StatusBadRequest)
			return
		}
		afterID = v
	}

	msgs, err := h.db.GetInbox(r.Context(), userID, afterID)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if msgs == nil {
		msgs = []repository.InboxMessage{} // return [] not null
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msgs) //nolint:errcheck
}
