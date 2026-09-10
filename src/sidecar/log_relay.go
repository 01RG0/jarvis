package main

import (
	"log/slog"
	"strings"
	"time"

	"github.com/gorilla/websocket"
)

type logRelay struct {
	hub      *Hub
	brainURL string
}

func newLogRelay(hub *Hub, brainURL string) *logRelay {
	wsURL := strings.Replace(brainURL, "http://", "ws://", 1)
	wsURL = strings.Replace(wsURL, "https://", "wss://", 1)
	return &logRelay{hub: hub, brainURL: wsURL}
}

func (lr *logRelay) run() {
	for {
		if err := lr.connect(); err != nil {
			slog.Warn("log relay disconnected, retrying in 5s", "err", err)
		}
		time.Sleep(5 * time.Second)
	}
}

func (lr *logRelay) connect() error {
	url := lr.brainURL + "/ws/logs"
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		return err
	}
	defer conn.Close()
	slog.Info("log relay connected", "url", url)

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return err
		}
		lr.hub.pushRawLog(msg)
	}
}
