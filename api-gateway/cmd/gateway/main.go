package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"messenger/api-gateway/internal/client"
	"messenger/api-gateway/internal/handler"
	"messenger/api-gateway/internal/repository"
	"messenger/api-gateway/internal/service"
)

func main() {
	cfg := loadConfig()

	db, err := repository.NewPostgres(context.Background(), cfg.DSN)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer db.Close()

	rdb := repository.NewRedis(cfg.RedisAddr)
	defer rdb.Close()

	keyClient := client.NewKeyServerClient(cfg.KeyServerURL)
	maskClient := client.NewMaskGeneratorClient(cfg.MaskGeneratorURL)
	cryptoSvc := service.NewCryptoService()

	msgSvc := service.NewMessageService(keyClient, maskClient, cryptoSvc, db, rdb)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux, msgSvc, rdb, db)

	srv := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("api-gateway listening on %s", cfg.ListenAddr)
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
	ListenAddr       string
	DSN              string
	RedisAddr        string
	KeyServerURL     string
	MaskGeneratorURL string
}

func loadConfig() config {
	return config{
		ListenAddr:       getenv("LISTEN_ADDR", ":8080"),
		DSN:              getenv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5432/messenger"),
		RedisAddr:        getenv("REDIS_ADDR", "localhost:6379"),
		KeyServerURL:     getenv("KEY_SERVER_URL", "http://localhost:8081"),
		MaskGeneratorURL: getenv("MASK_GENERATOR_URL", "http://localhost:8082"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
