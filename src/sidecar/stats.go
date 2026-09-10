package main

import (
	"log/slog"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
)

type StatsPayload struct {
	CPU       float64 `json:"cpu"`
	RAM       float64 `json:"ram"`
	RAMUsedGB float64 `json:"ram_used_gb"`
	Disk      float64 `json:"disk"`
	NetSentKB uint64  `json:"net_sent_kb"`
	NetRecvKB uint64  `json:"net_recv_kb"`
}

type statsCollector struct {
	hub      *Hub
	interval time.Duration
}

func newStatsCollector(hub *Hub) *statsCollector {
	return &statsCollector{hub: hub, interval: 2 * time.Second}
}

func (sc *statsCollector) run() {
	// Prime CPU baseline — first call always returns 0.
	cpu.Percent(0, false)
	time.Sleep(500 * time.Millisecond)

	ticker := time.NewTicker(sc.interval)
	defer ticker.Stop()

	for range ticker.C {
		payload, err := sc.collect()
		if err != nil {
			slog.Warn("stats collect error", "err", err)
			continue
		}
		sc.hub.pushStats(payload)
	}
}

func (sc *statsCollector) collect() (*StatsPayload, error) {
	cpuPcts, err := cpu.Percent(0, false)
	if err != nil {
		return nil, err
	}
	var cpuPct float64
	if len(cpuPcts) > 0 {
		cpuPct = cpuPcts[0]
	}

	vmStat, err := mem.VirtualMemory()
	if err != nil {
		return nil, err
	}

	diskStat, err := disk.Usage("/")
	if err != nil {
		// Windows — try C:
		diskStat, err = disk.Usage("C:")
		if err != nil {
			return nil, err
		}
	}

	ioStats, err := net.IOCounters(false)
	var sentKB, recvKB uint64
	if err == nil && len(ioStats) > 0 {
		sentKB = ioStats[0].BytesSent / 1024
		recvKB = ioStats[0].BytesRecv / 1024
	}

	return &StatsPayload{
		CPU:       round2(cpuPct),
		RAM:       round2(vmStat.UsedPercent),
		RAMUsedGB: round2(float64(vmStat.Used) / 1e9),
		Disk:      round2(diskStat.UsedPercent),
		NetSentKB: sentKB,
		NetRecvKB: recvKB,
	}, nil
}

func round2(f float64) float64 {
	return float64(int(f*100)) / 100
}
