
export interface Note {
  id: string;
  content: string;
  createdAt: number;
  tags: string[];
  topic: string;
  style?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  };
}

export interface Book {
  id: string;
  title: string;
  contentSnippet: string;
  progress: number;
  type: 'pdf' | 'image';
  mediaUrl: string;
}

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
  MINDMAP = 'mindmap',
  CHAT = 'chat',
  LIVE = 'live'
}

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
