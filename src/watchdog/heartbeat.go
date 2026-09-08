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

// sweepStalls removes tasks whose last heartbeat is older than h.timeout
// relative to now. Returns the IDs that were removed.
func (h *HeartbeatServer) sweepStalls(now time.Time) []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	var stalled []string
	for id, t := range h.lastSeen {
		if now.Sub(t) > h.timeout {
			stalled = append(stalled, id)
			delete(h.lastSeen, id)
		}
	}
	return stalled
}

func (h *HeartbeatServer) checkStalls() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		stalled := h.sweepStalls(time.Now())
		for _, id := range stalled {
			log.Printf("[watchdog] task stalled: %s", id)
		}
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
