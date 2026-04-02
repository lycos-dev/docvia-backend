export interface DocumentProgress {
  completedLessons: number;
  totalLessons: number;
  percentage: number;
  lastAccessedAt: string | null;
  streakDays: number;
}

export interface DocumentItem {
  id: number;
  filename: string;          // backend storage name (used as pdfId)
  title: string;
  subtitle: string;
  type: 'pdf' | 'book' | 'report';
  lastOpened: string;
  coverImage: string | null; // base64 data URL or public URL
  firstPageThumbnail: string | null;
  progress: DocumentProgress;
}

export type SortMode = 'recent' | 'oldest' | 'a-z' | 'z-a';
export type TypeFilter = 'all' | 'book' | 'report' | 'pdf';
