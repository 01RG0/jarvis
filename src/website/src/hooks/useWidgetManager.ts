'use client';

import { useState, useCallback } from 'react';

export type WidgetId = 'chat' | 'stats' | 'memory' | 'settings';
export type SpawnableType = 'clock' | 'notes' | 'sysmon' | 'graph' | 'webview' | 'logs' | 'media' | 'providers';

export interface SpawnedWidget {
  instanceId: string;
  type: SpawnableType;
}

type VisibilityMap = Record<WidgetId, boolean>;

const DEFAULT_VISIBILITY: VisibilityMap = {
  chat: false, stats: false, memory: false, settings: false,
};

let counter = 0;
function nextId() { return `w${++counter}`; }

export function useWidgetManager() {
  const [visibility, setVisibility] = useState<VisibilityMap>(DEFAULT_VISIBILITY);
  const [spawned, setSpawned]       = useState<SpawnedWidget[]>([]);

  const show   = useCallback((id: WidgetId) => setVisibility(p => ({ ...p, [id]: true  })), []);
  const hide   = useCallback((id: WidgetId) => setVisibility(p => ({ ...p, [id]: false })), []);
  const toggle = useCallback((id: WidgetId) => setVisibility(p => ({ ...p, [id]: !p[id] })), []);
  const visible = useCallback((id: WidgetId) => visibility[id], [visibility]);

  const spawn = useCallback((type: SpawnableType) => {
    setSpawned(prev => [...prev, { instanceId: nextId(), type }]);
  }, []);

  const despawn = useCallback((instanceId: string) => {
    setSpawned(prev => prev.filter(w => w.instanceId !== instanceId));
  }, []);

  return { show, hide, toggle, visible, visibility, spawned, spawn, despawn };
}
