export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type BadgeStatus = 'offline' | 'scanning' | 'detected';
export type LogType = 'info' | 'success' | 'warn' | 'detect';

export interface Item {
  name: string;
  qty: number;
  rarity: Rarity;
  lastSeen: number;
}

export interface ROIConfig {
  xPct: number;
  yPct: number;
  sizePct: number;
  threshold: number;
}

export interface ActivityPoint {
  time: string;
  count: number;
}

export interface LogEntry {
  id: number;
  time: string;
  msg: string;
  type: LogType;
}
