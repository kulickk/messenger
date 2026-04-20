package handler

import (
	"net/http"

	"messenger/api-gateway/internal/repository"
	"messenger/api-gateway/internal/service"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func RegisterRoutes(mux *http.ServeMux, msgSvc *service.MessageService, rdb *repository.RedisClient, db *repository.Postgres) {
	ws := NewWSHandler(msgSvc, rdb)
	inbox := NewInboxHandler(db)

	mux.Handle("/ws", corsMiddleware(http.HandlerFunc(ws.Handle)))
	mux.Handle("GET /inbox/{user_id}", corsMiddleware(http.HandlerFunc(inbox.Handle)))
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
}
