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
	"messenger/key-server/internal/cache"
	"messenger/key-server/internal/handler"
	"messenger/key-server/internal/repository"
	"messenger/key-server/internal/service"
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

	redisCache := cache.NewRedisCache(cfg.RedisAddr)
	repo := repository.NewKeysRepository(pool)
	cacheLayer := cache.NewCacheLayer(redisCache, repo)
	svc := service.NewKeysService(cacheLayer)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux, svc)

	srv := &http.Server{
		Addr:         cfg.ListenAddr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("key-server listening on %s", cfg.ListenAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

type config struct {
	ListenAddr string
	DSN        string
	RedisAddr  string
}

func loadConfig() config {
	return config{
		ListenAddr: getenv("LISTEN_ADDR", ":8081"),
		DSN:        getenv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5432/messenger"),
		RedisAddr:  getenv("REDIS_ADDR", "localhost:6379"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
