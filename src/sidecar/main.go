package main

import (
	"flag"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	port := flag.String("port", "8002", "HTTP/WS listen port")
	brainURL := flag.String("brain", "http://localhost:8001", "Python brain base URL")
	flag.Parse()

	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})))
	slog.Info("sidecar starting", "port", *port, "brain", *brainURL)

	hub := newHub()
	go hub.run()

	collector := newStatsCollector(hub)
	go collector.run()

	logRelay := newLogRelay(hub, *brainURL)
	go logRelay.run()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws/stats", hub.serveStatsWS)
	mux.HandleFunc("/ws/logs", hub.serveLogsWS)
	mux.HandleFunc("/ws/pc", hub.servePCWS)
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/metrics", hub.handleMetrics)

	srv := &http.Server{Addr: ":" + *port, Handler: corsMiddleware(mux)}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit
	slog.Info("sidecar shutting down")
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"ok","service":"jarvis-sidecar"}`))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
