export type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface MessageLog {
  id: string;
  role: 'user' | 'alka' | 'system';
  text: string;
  timestamp: string;
  mode: 'text' | 'voice' | 'system';
  toolCall?: {
    name: string;
    args: any;
  };
}

export interface RedirectConfig {
  isOpen: boolean;
  toolName: string;
  args: any;
  functionCallId: string;
}

export interface LatencyStats {
  ping: string;
  sensors: string;
  status: string;
}
