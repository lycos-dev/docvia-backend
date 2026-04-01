export interface DocumentItem {
  id: number;
  title: string;
  subtitle: string;
  type: 'book' | 'report';
  lastOpened: string;
  coverImage: string;
}

export type SortMode = 'recent' | 'oldest' | 'a-z' | 'z-a';
export type TypeFilter = 'all' | 'book' | 'report';