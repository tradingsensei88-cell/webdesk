export type Theme = 'dark' | 'light';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface PageSettings {
  size: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  margins: { top: number; bottom: number; left: number; right: number };
  columns: 1 | 2 | 3;
}

export interface VersionSnapshot {
  id: string;
  timestamp: number;
  content: string;
  title: string;
}
