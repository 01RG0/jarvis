package main

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
}

type clientSet struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]struct{}
}

func newClientSet() *clientSet { return &clientSet{clients: make(map[*websocket.Conn]struct{})} }

func (cs *clientSet) add(c *websocket.Conn) {
	cs.mu.Lock()
	cs.clients[c] = struct{}{}
	cs.mu.Unlock()
}

func (cs *clientSet) remove(c *websocket.Conn) {
	cs.mu.Lock()
	delete(cs.clients, c)
	cs.mu.Unlock()
	c.Close()
}

func (cs *clientSet) broadcast(msg []byte) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	for c := range cs.clients {
		go func(conn *websocket.Conn) {
			conn.SetWriteDeadline(time.Now().Add(3 * time.Second))
			if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				cs.remove(conn)
			}
		}(c)
	}
}

func (cs *clientSet) count() int {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	return len(cs.clients)
}

// Hub holds all client sets and the latest stats/log messages.
type Hub struct {
	stats   *clientSet
	logs    *clientSet
	pc      *clientSet
	lastMsg map[string][]byte
	msgMu   sync.RWMutex

	statsIn chan []byte
	logIn   chan []byte
	pcIn    chan []byte
}

func newHub() *Hub {
	return &Hub{
		stats:   newClientSet(),
		logs:    newClientSet(),
		pc:      newClientSet(),
		lastMsg: make(map[string][]byte),
		statsIn: make(chan []byte, 64),
		logIn:   make(chan []byte, 512),
		pcIn:    make(chan []byte, 64),
	}
}

func (h *Hub) run() {
	for {
		select {
		case msg := <-h.statsIn:
			h.msgMu.Lock()
			h.lastMsg["stats"] = msg
			h.msgMu.Unlock()
			h.stats.broadcast(msg)

		case msg := <-h.logIn:
			h.logs.broadcast(msg)

		case msg := <-h.pcIn:
			h.pc.broadcast(msg)
		}
	}
}

func (h *Hub) pushStats(data any) {
	b, _ := json.Marshal(data)
	h.statsIn <- b
}

func (h *Hub) pushLog(data any) {
	b, _ := json.Marshal(data)
	select {
	case h.logIn <- b:
	default: // drop if channel full — logs are lossy
	}
}

func (h *Hub) pushRawLog(b []byte) {
	select {
	case h.logIn <- b:
	default:
	}
}

// serveStatsWS upgrades a request to WebSocket and joins the stats client set.
func (h *Hub) serveStatsWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Warn("stats ws upgrade failed", "err", err)
		return
	}
	h.stats.add(conn)
	slog.Debug("stats ws client connected", "total", h.stats.count())

	// Send last known stats immediately so client doesn't wait up to 2s.
	h.msgMu.RLock()
	last := h.lastMsg["stats"]
	h.msgMu.RUnlock()
	if last != nil {
		conn.WriteMessage(websocket.TextMessage, last)
	}

	// Drain incoming (pings/close) in a goroutine; remove on error.
	go func() {
		defer h.stats.remove(conn)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()
}

// serveLogsWS upgrades and joins the logs fan-out.
func (h *Hub) serveLogsWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	h.logs.add(conn)
	slog.Debug("logs ws client connected", "total", h.logs.count())
	go func() {
		defer h.logs.remove(conn)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()
}

// servePCWS is the relay endpoint for the home PC agent.
func (h *Hub) servePCWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	h.pc.add(conn)
	slog.Info("PC agent connected", "remote", r.RemoteAddr)
	go func() {
		defer func() {
			h.pc.remove(conn)
			slog.Info("PC agent disconnected")
		}()
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			// Forward PC→Brain responses to the logIn fan-out as structured events.
			h.logIn <- msg
		}
	}()
}

func (h *Hub) handleMetrics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{
		"stats_clients": h.stats.count(),
		"log_clients":   h.logs.count(),
		"pc_clients":    h.pc.count(),
	})
}
