
export interface Note {
  id: string;
  content: string;
  createdAt: number;
  tags: string[];
  style?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
}

export interface DailyCheckIn {
  date: string; // YYYY-MM-DD
  status: boolean;
  notes: string;
}

export interface PDFAnnotation {
  page: number;
  drawings: Array<{
    points: Array<{ x: number, y: number }>;
    color: string;
    width: number;
  }>;
  notes: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
  }>;
}

export interface Book {
  id: string;
  title: string;
  contentSnippet: string;
  progress: number; // 0 to 100
  type: 'pdf' | 'video' | 'image';
  mediaUrl?: string;
  annotations?: Record<number, PDFAnnotation>;
}

export enum ViewMode {
  DASHBOARD = 'dashboard',
  NOTES = 'notes',
  READER = 'reader',
  STUDIO = 'studio',
  PROGRESS = 'progress',
  SETTINGS = 'settings'
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
