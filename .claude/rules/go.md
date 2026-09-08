---
paths:
  - "src/watchdog/**/*.go"
---

# Go Rules

- Never `exec.Command("sh", "-c", ...)` — always pass args as a slice: `exec.Command(parts[0], parts[1:]...)`
- Validate all user-supplied paths with `filepath.Clean` + check they're within expected prefix
- Export only what callers need; keep watchdog internals unexported
- `log/slog` for structured logging (Go 1.21+)
- Graceful shutdown: catch `SIGTERM`/`SIGINT`, drain in-flight work, then exit 0
- Keep binary static: `CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build`
