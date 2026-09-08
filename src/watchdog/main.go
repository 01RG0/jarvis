package main

import (
	"flag"
	"log"
	"time"
)

func main() {
	watch := flag.String("watch", "", "Command to supervise (space-separated, no shell)")
	heartbeatPort := flag.Int("heartbeat-port", 8099, "Port for heartbeat HTTP server")
	heartbeatTimeout := flag.Int("heartbeat-timeout", 120, "Seconds before task is considered stalled")
	flag.Parse()

	startTime := time.Now()
	hs := startHeartbeatServer(*heartbeatPort, *heartbeatTimeout, startTime)
	_ = hs

	if *watch == "" {
		log.Printf("[watchdog] running, no process to supervise (heartbeat on :%d)", *heartbeatPort)
		select {}
	}

	log.Printf("[watchdog] supervising: %s", *watch)
	supervise(*watch)
}
