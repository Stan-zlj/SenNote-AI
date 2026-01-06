
export interface Note {
  id: string;
  content: string;
  createdAt: number;
  tags: string[];
}

export interface DailyCheckIn {
  date: string; // YYYY-MM-DD
  status: boolean;
  notes: string;
}

export interface Book {
  id: string;
  title: string;
  contentSnippet: string;
  progress: number; // 0 to 100
  type: 'pdf' | 'video' | 'image';
  mediaUrl?: string;
}

export enum ViewMode {
  NOTES = 'notes',
  READER = 'reader',
  STUDIO = 'studio',
  PROGRESS = 'progress',
  SETTINGS = 'settings'
}

export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";
