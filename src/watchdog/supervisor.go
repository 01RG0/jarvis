package main

import (
	"log"
	"os"
	"os/exec"
	"strings"
	"time"
)

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
		backoff *= 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
	}
}
