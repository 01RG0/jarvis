package main

import (
	"log"
	"os"
	"os/exec"
	"strings"
	"time"
)

// nextBackoff returns the next backoff duration, capped at max.
func nextBackoff(current, max time.Duration) time.Duration {
	next := current * 2
	if next > max {
		return max
	}
	return next
}

func supervise(command string) {
	parts := strings.Fields(command)
	if len(parts) == 0 {
		log.Fatal("[watchdog] empty command")
	}
	backoff := time.Second
	maxBackoff := 30 * time.Second
	for {
		log.Printf("[watchdog] starting: %v", parts)
		cmd := exec.Command(parts[0], parts[1:]...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			log.Printf("[watchdog] process exited: %v — restarting in %v", err, backoff)
		} else {
			log.Printf("[watchdog] process exited cleanly — restarting in %v", backoff)
		}
		time.Sleep(backoff)
		backoff = nextBackoff(backoff, maxBackoff)
	}
}
