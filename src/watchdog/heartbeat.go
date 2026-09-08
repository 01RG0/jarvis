package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"
)

type HeartbeatServer struct {
	lastSeen  map[string]time.Time
	mu        sync.Mutex
	timeout   time.Duration
	startTime time.Time
}

func (h *HeartbeatServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/heartbeat":
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var body struct {
			TaskID string `json:"task_id"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		if body.TaskID != "" {
			h.mu.Lock()
			h.lastSeen[body.TaskID] = time.Now()
			h.mu.Unlock()
		}
		w.WriteHeader(http.StatusOK)
	case "/health":
		h.mu.Lock()
		active := len(h.lastSeen)
		h.mu.Unlock()
		uptime := int(time.Since(h.startTime).Seconds())
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":         "ok",
			"uptime_seconds": uptime,
			"active_tasks":   active,
		})
	default:
		http.NotFound(w, r)
	}
}

func (h *HeartbeatServer) checkStalls() {
	for range time.Tick(10 * time.Second) {
		h.mu.Lock()
		for id, t := range h.lastSeen {
			if time.Since(t) > h.timeout {
				log.Printf("[watchdog] task stalled: %s (last heartbeat %v ago)", id, time.Since(t).Round(time.Second))
				delete(h.lastSeen, id)
			}
		}
		h.mu.Unlock()
	}
}

func startHeartbeatServer(port int, timeoutSeconds int, startTime time.Time) *HeartbeatServer {
	hs := &HeartbeatServer{
		lastSeen:  make(map[string]time.Time),
		timeout:   time.Duration(timeoutSeconds) * time.Second,
		startTime: startTime,
	}
	go hs.checkStalls()
	mux := http.NewServeMux()
	mux.Handle("/", hs)
	go func() {
		addr := fmt.Sprintf(":%d", port)
		log.Printf("[watchdog] heartbeat server on %s", addr)
		if err := http.ListenAndServe(addr, mux); err != nil {
			log.Printf("[watchdog] heartbeat server error: %v", err)
		}
	}()
	return hs
}
