# Research: Go Watchdog Design

**Verdict: Build it in Phase 0. Go is the right choice — single binary, zero deps, survives Python/Node crashes.**

## Why Go

The watchdog's job is to stay alive when everything else fails. A Python watchdog supervising
Python processes shares the same interpreter and the same crash surface. A Node watchdog shares
the same V8 runtime. A Go binary is a statically-linked single file that starts in milliseconds
and has no runtime dependency — perfect for a sentinel process.

Target metrics:
- Binary size: <15 MB (static, no CGO)
- Idle RAM: <10 MB
- Start time: <100ms

## Core Responsibilities

1. **Process supervision:** restart crashed subprocesses (brain server, gateway, website)
2. **Task heartbeat:** each in-flight task emits a heartbeat; watchdog marks stalled tasks
3. **Resource caps enforcement:** cgroups/systemd limits prevent runaway tasks
4. **Health endpoint:** `GET /health` returns current system state

## Process Supervision Implementation

```go
// supervisor.go
package main

import (
    "log"
    "os/exec"
    "time"
)

type ManagedProcess struct {
    Name    string
    Command []string
    Delay   time.Duration
}

func supervise(p ManagedProcess) {
    for {
        log.Printf("[watchdog] starting %s: %v", p.Name, p.Command)
        // SAFE: pass arguments directly, no shell interpolation
        cmd := exec.Command(p.Command[0], p.Command[1:]...)
        cmd.Stdout = os.Stdout
        cmd.Stderr = os.Stderr
        
        if err := cmd.Start(); err != nil {
            log.Printf("[watchdog] failed to start %s: %v — retrying in %v", p.Name, err, p.Delay)
            time.Sleep(p.Delay)
            continue
        }
        
        if err := cmd.Wait(); err != nil {
            log.Printf("[watchdog] %s exited: %v — restarting in %v", p.Name, err, p.Delay)
        }
        time.Sleep(p.Delay)
    }
}
```

## Task Heartbeat Protocol

Brain emits: `POST http://localhost:8099/heartbeat` with body `{"task_id": "...", "status": "running"}`

Watchdog tracks: `map[taskID]lastSeen`. If `time.Since(lastSeen) > HeartbeatTimeout`, mark task stalled and notify gateway.

```go
// heartbeat.go
type HeartbeatServer struct {
    mu          sync.Mutex
    lastSeen    map[string]time.Time
    timeout     time.Duration
    onStall     func(taskID string)
}

func (h *HeartbeatServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    var body struct{ TaskID string `json:"task_id"` }
    json.NewDecoder(r.Body).Decode(&body)
    h.mu.Lock()
    h.lastSeen[body.TaskID] = time.Now()
    h.mu.Unlock()
    w.WriteHeader(http.StatusOK)
}

func (h *HeartbeatServer) checkLoop() {
    for range time.Tick(10 * time.Second) {
        h.mu.Lock()
        for id, t := range h.lastSeen {
            if time.Since(t) > h.timeout {
                h.onStall(id)
                delete(h.lastSeen, id)
            }
        }
        h.mu.Unlock()
    }
}
```

## Resource Caps

The watchdog doesn't set cgroups directly — it uses systemd unit files for always-on processes
and `ulimit`/`prlimit` for spawned task workloads:

```go
import "syscall"

func limitedCmd(command []string) *exec.Cmd {
    cmd := exec.Command(command[0], command[1:]...)
    cmd.SysProcAttr = &syscall.SysProcAttr{
        // Create new process group (allows sending SIGKILL to entire group)
        Setpgid: true,
    }
    // Set memory limit via prlimit (Linux only)
    // Use syscall.Prlimit or a helper library
    return cmd
}
```

For systemd-managed processes, resource limits go in the unit file `MemoryMax=512M`.

## Health Endpoint

```go
http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
    json.NewEncoder(w).Encode(map[string]interface{}{
        "status":    "ok",
        "processes": supervisor.Status(),
        "tasks":     heartbeat.ActiveTasks(),
    })
})
```

## Build Flags

```makefile
.PHONY: build
build:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
	  go build -ldflags="-s -w" -o bin/jarvis-watchdog ./cmd/watchdog

# Cross-compile from Windows for the Azure VM
build-linux:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/jarvis-watchdog-linux ./cmd/watchdog
```

## Gotchas

- **Never use `exec.Command("sh", "-c", cmd)`** — that's a shell injection vector. Always pass command and args separately: `exec.Command(command[0], command[1:]...)`
- The watchdog should NOT restart a process more than N times per minute — add an exponential backoff with a max delay to avoid CPU spin on a persistently crashing process
- Heartbeat port (8099) should be bound to localhost only — it's an internal control channel, not public

## Resources

- Go process management: `os/exec` package docs
- Go signal handling: `os/signal`, `syscall.SIGTERM`
- `go-supervisor` pattern: many examples in the Go ecosystem
