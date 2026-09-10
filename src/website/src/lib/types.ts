export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface ServerStatus {
  connected: boolean;
  uptime_seconds?: number;
  active_tasks?: number;
  memory_entries?: number;
}
