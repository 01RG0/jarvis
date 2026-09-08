package main

import (
	"testing"
	"time"
)

func TestNextBackoff_Doubles(t *testing.T) {
	cases := []struct {
		current  time.Duration
		max      time.Duration
		expected time.Duration
	}{
		{1 * time.Second, 30 * time.Second, 2 * time.Second},
		{2 * time.Second, 30 * time.Second, 4 * time.Second},
		{16 * time.Second, 30 * time.Second, 30 * time.Second},
		{30 * time.Second, 30 * time.Second, 30 * time.Second},
		{100 * time.Second, 30 * time.Second, 30 * time.Second},
	}
	for _, c := range cases {
		got := nextBackoff(c.current, c.max)
		if got != c.expected {
			t.Errorf("nextBackoff(%v, %v) = %v, want %v", c.current, c.max, got, c.expected)
		}
	}
}

func TestNextBackoff_NeverExceedsMax(t *testing.T) {
	max := 30 * time.Second
	d := time.Second
	for i := 0; i < 20; i++ {
		d = nextBackoff(d, max)
		if d > max {
			t.Fatalf("backoff %v exceeded max %v after %d iterations", d, max, i+1)
		}
	}
}

func TestNextBackoff_ConvergesToMax(t *testing.T) {
	max := 30 * time.Second
	d := time.Second
	for i := 0; i < 10; i++ {
		d = nextBackoff(d, max)
	}
	if d != max {
		t.Errorf("expected backoff to converge to %v, got %v", max, d)
	}
}
