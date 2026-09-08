package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func newTestServer(timeoutSeconds int) *HeartbeatServer {
	return &HeartbeatServer{
		lastSeen:  make(map[string]time.Time),
		timeout:   time.Duration(timeoutSeconds) * time.Second,
		startTime: time.Now(),
	}
}

func TestBeat_RecordsTask(t *testing.T) {
	hs := newTestServer(60)
	hs.mu.Lock()
	hs.lastSeen["task-1"] = time.Now()
	hs.mu.Unlock()

	hs.mu.Lock()
	_, ok := hs.lastSeen["task-1"]
	hs.mu.Unlock()

	if !ok {
		t.Fatal("expected task-1 to be recorded after beat")
	}
}

func TestSweepStalls_RemovesExpiredTasks(t *testing.T) {
	hs := newTestServer(60)

	past := time.Now().Add(-90 * time.Second)
	recent := time.Now().Add(-10 * time.Second)

	hs.mu.Lock()
	hs.lastSeen["stale-task"] = past
	hs.lastSeen["fresh-task"] = recent
	hs.mu.Unlock()

	stalled := hs.sweepStalls(time.Now())

	if len(stalled) != 1 || stalled[0] != "stale-task" {
		t.Fatalf("expected [stale-task] to be stalled, got %v", stalled)
	}

	hs.mu.Lock()
	_, stillHasStale := hs.lastSeen["stale-task"]
	_, stillHasFresh := hs.lastSeen["fresh-task"]
	hs.mu.Unlock()

	if stillHasStale {
		t.Error("stale-task should have been removed from lastSeen")
	}
	if !stillHasFresh {
		t.Error("fresh-task should still be in lastSeen")
	}
}

func TestSweepStalls_EmptyWhenNothingExpired(t *testing.T) {
	hs := newTestServer(60)
	hs.mu.Lock()
	hs.lastSeen["task-a"] = time.Now()
	hs.mu.Unlock()

	stalled := hs.sweepStalls(time.Now())
	if len(stalled) != 0 {
		t.Fatalf("expected no stalls, got %v", stalled)
	}
}

func TestServeHTTP_HeartbeatPost_RecordsTask(t *testing.T) {
	hs := newTestServer(60)

	body, _ := json.Marshal(map[string]string{"task_id": "test-task"})
	req := httptest.NewRequest(http.MethodPost, "/heartbeat", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	hs.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	hs.mu.Lock()
	_, ok := hs.lastSeen["test-task"]
	hs.mu.Unlock()
	if !ok {
		t.Error("expected test-task to be recorded in lastSeen")
	}
}

func TestServeHTTP_HeartbeatGet_MethodNotAllowed(t *testing.T) {
	hs := newTestServer(60)
	req := httptest.NewRequest(http.MethodGet, "/heartbeat", nil)
	rec := httptest.NewRecorder()
	hs.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

func TestServeHTTP_Health_ReturnsJSON(t *testing.T) {
	hs := newTestServer(60)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	hs.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var resp map[string]interface{}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}
	if resp["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", resp["status"])
	}
	if _, ok := resp["uptime_seconds"]; !ok {
		t.Error("expected uptime_seconds in response")
	}
	if _, ok := resp["active_tasks"]; !ok {
		t.Error("expected active_tasks in response")
	}
}

func TestServeHTTP_Health_ActiveTaskCount(t *testing.T) {
	hs := newTestServer(60)
	hs.mu.Lock()
	hs.lastSeen["t1"] = time.Now()
	hs.lastSeen["t2"] = time.Now()
	hs.mu.Unlock()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	hs.ServeHTTP(rec, req)

	var resp map[string]interface{}
	json.NewDecoder(rec.Body).Decode(&resp)
	if int(resp["active_tasks"].(float64)) != 2 {
		t.Errorf("expected active_tasks=2, got %v", resp["active_tasks"])
	}
}

func TestServeHTTP_UnknownPath_Returns404(t *testing.T) {
	hs := newTestServer(60)
	req := httptest.NewRequest(http.MethodGet, "/unknown", nil)
	rec := httptest.NewRecorder()
	hs.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}
