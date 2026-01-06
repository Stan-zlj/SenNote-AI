
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

// Fix: Added missing Book interface for ReaderView
export interface Book {
  id: string;
  title: string;
  contentSnippet: string;
  progress: number;
  type: 'pdf' | 'image';
  mediaUrl: string;
}

// Fix: Added missing DailyCheckIn interface for ProgressView
export interface DailyCheckIn {
  date: string;
}

export interface MindMapNode {
  label: string;
  children?: MindMapNode[];
}

export enum ViewMode {
  DASHBOARD = 'dashboard',
  NOTES = 'notes',
  STUDIO = 'studio',
  MINDMAP = 'mindmap'
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
