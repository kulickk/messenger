package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"messenger/mask-generator/internal/handler"
	"messenger/mask-generator/internal/loader"
	"messenger/mask-generator/internal/ollama"
)

func main() {
	cfg := loadConfig()

	pool, err := pgxpool.New(context.Background(), cfg.DSN)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("postgres ping: %v", err)
	}

	cipherLoader := loader.NewCipherLoader(pool)

	var generator ollama.Generator
	if cfg.MockMasks {
		generator = &ollama.MockClient{}
		log.Println("mask-generator: MOCK_MASKS=true — Ollama disabled, using stub responses")
	} else {
		generator = ollama.NewClient(cfg.OllamaURL)
		log.Printf("mask-generator: using Ollama at %s", cfg.OllamaURL)
	}

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux, cipherLoader, generator)

	srv := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 90 * time.Second, // LLM inference can take time
	}

	go func() {
		log.Printf("mask-generator listening on %s", cfg.ListenAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

type config struct {
	ListenAddr string
	DSN        string
	OllamaURL  string
	MockMasks  bool
}

func loadConfig() config {
	return config{
		ListenAddr: getenv("LISTEN_ADDR", ":8082"),
		DSN:        getenv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5432/messenger"),
		OllamaURL:  getenv("OLLAMA_URL", "http://localhost:11434"),
		MockMasks:  os.Getenv("MOCK_MASKS") == "true",
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
