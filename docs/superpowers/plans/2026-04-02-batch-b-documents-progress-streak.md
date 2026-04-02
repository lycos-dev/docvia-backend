# Batch B — DocumentsContext, Card Progress UI, ProgressContext + ProgressPage, Streak

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `DocumentsContext` (per-user document list in localStorage), update `ReadingCard` with a progress bar, implement `ProgressContext` + `ProgressPage` with a 7-day SVG chart, and enhance `StreakCard` with activity grid, animated flame, and milestone messages.

**Architecture:** Two new contexts added to `App.tsx` in order: `ThemeProvider → AuthProvider → ProgressProvider → DocumentsProvider`. `DocumentsContext` stores documents keyed by `userId`. `ProgressContext` stores lesson/document progress in localStorage under `'docvia-progress'`. `StreakCard` reads from `ProgressContext`. `ReadingCard` reads progress from its `DocumentItem`. All mock data is preserved — contexts add their own data layer on top.

**Tech Stack:** React 19, TypeScript 5.9 strict, Tailwind v4, no new packages.

---

### Task 1: Update `DocumentItem` type + create `DocumentsContext`

**Files:**
- Modify: `frontend-src/src/features/dashboard/types/index.ts`
- Create: `frontend-src/src/shared/contexts/DocumentsContext.tsx`

- [ ] **Step 1: Replace `frontend-src/src/features/dashboard/types/index.ts`**

```ts
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
```

- [ ] **Step 2: Create `frontend-src/src/shared/contexts/DocumentsContext.tsx`**

```tsx
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import type { DocumentItem } from '../../features/dashboard/types';

const STORAGE_KEY = (userId: string) => `docvia-documents-${userId}`;

interface DocumentsContextValue {
  documents: DocumentItem[];
  isLoading: boolean;
  addDocument: (doc: DocumentItem) => void;
  removeDocument: (filename: string) => void;
  updateDocument: (filename: string, updates: Partial<DocumentItem>) => void;
}

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage whenever userId changes
  useEffect(() => {
    if (!user?.id) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY(user.id));
      setDocuments(stored ? (JSON.parse(stored) as DocumentItem[]) : []);
    } catch {
      setDocuments([]);
    }
    setIsLoading(false);
  }, [user?.id]);

  const persist = useCallback(
    (docs: DocumentItem[]) => {
      if (user?.id) {
        localStorage.setItem(STORAGE_KEY(user.id), JSON.stringify(docs));
      }
    },
    [user?.id]
  );

  const addDocument = useCallback(
    (doc: DocumentItem) => {
      setDocuments((prev) => {
        // Avoid duplicates by filename
        const exists = prev.some((d) => d.filename === doc.filename);
        const next = exists ? prev : [doc, ...prev];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeDocument = useCallback(
    (filename: string) => {
      setDocuments((prev) => {
        const next = prev.filter((d) => d.filename !== filename);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const updateDocument = useCallback(
    (filename: string, updates: Partial<DocumentItem>) => {
      setDocuments((prev) => {
        const next = prev.map((d) => (d.filename === filename ? { ...d, ...updates } : d));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return (
    <DocumentsContext.Provider value={{ documents, isLoading, addDocument, removeDocument, updateDocument }}>
      {children}
    </DocumentsContext.Provider>
  );
}

export function useDocuments(): DocumentsContextValue {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments must be used within DocumentsProvider');
  return ctx;
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/features/dashboard/types/index.ts frontend-src/src/shared/contexts/DocumentsContext.tsx
git commit -m "feat: update DocumentItem type (progress, thumbnail), create DocumentsContext"
```

---

### Task 2: Create `ProgressContext` and `useProgress` hook

**Files:**
- Create: `frontend-src/src/shared/contexts/ProgressContext.tsx`
- Create: `frontend-src/src/shared/hooks/useProgress.ts`

- [ ] **Step 1: Create `frontend-src/src/shared/contexts/ProgressContext.tsx`**

```tsx
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'docvia-progress';

export interface LessonProgress {
  lessonId: string;
  documentId: string;
  isCompleted: boolean;
  completedAt: string | null;
  timeSpentSeconds: number;
  attempts: number;
}

export interface DocumentProgress {
  documentId: string;
  completedLessons: string[];
  currentLessonId: string | null;
  totalLessons: number;
  percentage: number;
  startedAt: string;
  lastAccessedAt: string;
  streakDays: number;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;   // ISO date string (YYYY-MM-DD)
  streakStartDate: string | null;
  weekActivity: boolean[];         // [mon, tue, wed, thu, fri, sat, sun] — last 7 days
  todayCompleted: boolean;
}

interface ProgressStore {
  documentProgress: Record<string, DocumentProgress>;
  lessonProgress: Record<string, LessonProgress>;
  streak: StreakData;
  dailyCompletions: Record<string, number>; // ISO date → count of lessons completed
}

interface ProgressContextValue {
  documentProgress: Record<string, DocumentProgress>;
  lessonProgress: Record<string, LessonProgress>;
  streak: StreakData;
  markLessonComplete: (documentId: string, lessonId: string, totalLessons: number) => void;
  setCurrentLesson: (documentId: string, lessonId: string) => void;
  getDocumentProgress: (documentId: string) => DocumentProgress | null;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function computeWeekActivity(dailyCompletions: Record<string, number>): boolean[] {
  const result: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    result.push((dailyCompletions[key] ?? 0) > 0);
  }
  return result; // index 0 = 6 days ago, index 6 = today
}

function computeStreak(
  dailyCompletions: Record<string, number>,
  prevStreak: StreakData
): StreakData {
  const today = todayISO();
  const todayCompleted = (dailyCompletions[today] ?? 0) > 0;
  const weekActivity = computeWeekActivity(dailyCompletions);

  // Walk backwards from today to find consecutive days
  let currentStreak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().split('T')[0];
    if ((dailyCompletions[key] ?? 0) > 0) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  const longestStreak = Math.max(prevStreak.longestStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    lastActiveDate: today,
    streakStartDate: prevStreak.streakStartDate,
    weekActivity,
    todayCompleted,
  };
}

const INITIAL_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  streakStartDate: null,
  weekActivity: [false, false, false, false, false, false, false],
  todayCompleted: false,
};

const INITIAL_STORE: ProgressStore = {
  documentProgress: {},
  lessonProgress: {},
  streak: INITIAL_STREAK,
  dailyCompletions: {},
};

function loadStore(): ProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STORE;
    return { ...INITIAL_STORE, ...JSON.parse(raw) };
  } catch {
    return INITIAL_STORE;
  }
}

function saveStore(store: ProgressStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<ProgressStore>(loadStore);

  // Recompute streak on mount in case a day has passed
  useEffect(() => {
    setStore((prev) => {
      const streak = computeStreak(prev.dailyCompletions, prev.streak);
      const next = { ...prev, streak };
      saveStore(next);
      return next;
    });
  }, []);

  const markLessonComplete = useCallback(
    (documentId: string, lessonId: string, totalLessons: number) => {
      setStore((prev) => {
        const key = `${documentId}:${lessonId}`;
        if (prev.lessonProgress[key]?.isCompleted) return prev; // already done

        const lessonProg: LessonProgress = {
          lessonId,
          documentId,
          isCompleted: true,
          completedAt: new Date().toISOString(),
          timeSpentSeconds: 0,
          attempts: (prev.lessonProgress[key]?.attempts ?? 0) + 1,
        };

        const existingDoc = prev.documentProgress[documentId];
        const completedLessons = Array.from(
          new Set([...(existingDoc?.completedLessons ?? []), lessonId])
        );
        const percentage = totalLessons > 0
          ? Math.round((completedLessons.length / totalLessons) * 100)
          : 0;

        const docProg: DocumentProgress = {
          documentId,
          completedLessons,
          currentLessonId: existingDoc?.currentLessonId ?? null,
          totalLessons,
          percentage,
          startedAt: existingDoc?.startedAt ?? new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          streakDays: existingDoc?.streakDays ?? 0,
        };

        const today = todayISO();
        const dailyCompletions = {
          ...prev.dailyCompletions,
          [today]: (prev.dailyCompletions[today] ?? 0) + 1,
        };

        const streak = computeStreak(dailyCompletions, prev.streak);

        const next: ProgressStore = {
          documentProgress: { ...prev.documentProgress, [documentId]: docProg },
          lessonProgress: { ...prev.lessonProgress, [key]: lessonProg },
          streak,
          dailyCompletions,
        };
        saveStore(next);
        return next;
      });
    },
    []
  );

  const setCurrentLesson = useCallback((documentId: string, lessonId: string) => {
    setStore((prev) => {
      const existing = prev.documentProgress[documentId];
      const docProg: DocumentProgress = {
        documentId,
        completedLessons: existing?.completedLessons ?? [],
        currentLessonId: lessonId,
        totalLessons: existing?.totalLessons ?? 0,
        percentage: existing?.percentage ?? 0,
        startedAt: existing?.startedAt ?? new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        streakDays: existing?.streakDays ?? 0,
      };
      const next = {
        ...prev,
        documentProgress: { ...prev.documentProgress, [documentId]: docProg },
      };
      saveStore(next);
      return next;
    });
  }, []);

  const getDocumentProgress = useCallback(
    (documentId: string): DocumentProgress | null =>
      store.documentProgress[documentId] ?? null,
    [store.documentProgress]
  );

  return (
    <ProgressContext.Provider
      value={{
        documentProgress: store.documentProgress,
        lessonProgress: store.lessonProgress,
        streak: store.streak,
        markLessonComplete,
        setCurrentLesson,
        getDocumentProgress,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgressContext(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgressContext must be used within ProgressProvider');
  return ctx;
}
```

- [ ] **Step 2: Create `frontend-src/src/shared/hooks/useProgress.ts`**

```ts
export { useProgressContext as useProgress } from '../contexts/ProgressContext';
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/shared/contexts/ProgressContext.tsx frontend-src/src/shared/hooks/useProgress.ts
git commit -m "feat: create ProgressContext — lesson/doc progress, streak calculation, localStorage persistence"
```

---

### Task 3: Wire contexts into `App.tsx`

**Files:**
- Modify: `frontend-src/src/app/App.tsx`

- [ ] **Step 1: Replace `App.tsx`**

```tsx
import { AppRouter } from './router/router_index.tsx';
import { ThemeProvider } from '../shared/contexts/ThemeContext.tsx';
import { AuthProvider } from '../shared/contexts/AuthContext.tsx';
import { ProgressProvider } from '../shared/contexts/ProgressContext.tsx';
import { DocumentsProvider } from '../shared/contexts/DocumentsContext.tsx';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProgressProvider>
          <DocumentsProvider>
            <AppRouter />
          </DocumentsProvider>
        </ProgressProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/app/App.tsx
git commit -m "feat: wrap AppRouter in ProgressProvider and DocumentsProvider"
```

---

### Task 4: Wire `UploadModal`, `ReadingSection`, `ReadingCard`, and Sidebar to `DocumentsContext`

**Files:**
- Modify: `frontend-src/src/features/dashboard/components/Sidebar/UploadModal.tsx`
- Modify: `frontend-src/src/features/dashboard/components/ReadingSection.tsx`
- Modify: `frontend-src/src/features/dashboard/components/ReadingCard.tsx`
- Modify: `frontend-src/src/features/dashboard/components/Sidebar/FileRow.tsx`

- [ ] **Step 1: Update `UploadModal.tsx` — call `addDocument` on success**

In `UploadModal.tsx`, add the import and hook:
```tsx
import { useDocuments } from '../../../../shared/contexts/DocumentsContext';
```

Inside `UploadModal`, add after `const { token } = useAuth();`:
```tsx
const { addDocument } = useDocuments();
```

Replace the success branch in `uploadFile` (after `if (result.success)`):
```tsx
if (result.success && result.data) {
  // Add to DocumentsContext
  addDocument({
    id: Date.now(),
    filename: result.data.filename,
    title: result.data.originalFilename.replace(/\.pdf$/i, ''),
    subtitle: '',
    type: 'pdf',
    lastOpened: new Date().toISOString(),
    coverImage: null,
    firstPageThumbnail: null,
    progress: {
      completedLessons: 0,
      totalLessons: 0,
      percentage: 0,
      lastAccessedAt: null,
      streakDays: 0,
    },
  });
  onClose(true);
}
```

- [ ] **Step 2: Update `ReadingSection.tsx` — use `DocumentsContext` instead of mock array**

At the top of `ReadingSection.tsx`, add the import:
```tsx
import { useDocuments } from '../../../shared/contexts/DocumentsContext';
```

Inside `ReadingSection`, replace `const mockDocuments = [...]` and its usage with:
```tsx
const { documents, isLoading } = useDocuments();
// Use documents in place of mockDocuments everywhere in this component.
// Keep mockDocuments array as a fallback for when documents is empty and user is not logged in:
const mockDocuments: DocumentItem[] = [
  { id: 1, filename: 'mock-1', title: 'Testing Techniques', subtitle: 'Testing techniques in test case development', type: 'book', lastOpened: '2026-02-10', coverImage: '/assets/images/testing.png', firstPageThumbnail: null, progress: { completedLessons: 0, totalLessons: 0, percentage: 0, lastAccessedAt: null, streakDays: 0 } },
  { id: 2, filename: 'mock-2', title: 'Research Draft', subtitle: 'Reading preview text', type: 'report', lastOpened: '2026-02-18', coverImage: '/assets/images/research.jpg', firstPageThumbnail: null, progress: { completedLessons: 3, totalLessons: 12, percentage: 25, lastAccessedAt: '2026-04-01T10:00:00Z', streakDays: 2 } },
  { id: 3, filename: 'mock-3', title: 'Meeting Summary', subtitle: 'Sprint call highlights', type: 'report', lastOpened: '2026-01-27', coverImage: '/assets/images/meeting.jpg', firstPageThumbnail: null, progress: { completedLessons: 12, totalLessons: 12, percentage: 100, lastAccessedAt: '2026-03-15T14:00:00Z', streakDays: 5 } },
  { id: 4, filename: 'mock-4', title: 'Design System', subtitle: 'Component library documentation', type: 'book', lastOpened: '2026-02-15', coverImage: '/assets/images/design.png', firstPageThumbnail: null, progress: { completedLessons: 0, totalLessons: 8, percentage: 0, lastAccessedAt: null, streakDays: 0 } },
];
const sourceDocuments = documents.length > 0 ? documents : mockDocuments;
```

Then in `filteredAndSortedDocuments`, replace `mockDocuments` with `sourceDocuments`.

In the `total` calculation, replace `mockDocuments` with `sourceDocuments`.

Add a loading state display before the grid:
```tsx
{isLoading && (
  <div className="text-sm text-gray-400 dark:text-gray-500 mb-4">Loading documents…</div>
)}
```

- [ ] **Step 3: Update `ReadingCard.tsx` — wire `handleDelete` to `removeDocument` and `handleSaveTitle` to `updateDocument`**

Add import:
```tsx
import { useDocuments } from '../../../shared/contexts/DocumentsContext';
import { useNavigate } from 'react-router-dom';
```

Inside `ReadingCard`, add:
```tsx
const { removeDocument, updateDocument } = useDocuments();
const navigate = useNavigate();
```

Replace `handleCardClick`:
```tsx
const handleCardClick = () => {
  if (!isEditingTitle) {
    navigate(`/roadmap/${encodeURIComponent(document.filename)}`);
  }
};
```

Replace `handleSaveTitle`:
```tsx
const handleSaveTitle = () => {
  const trimmed = editedTitle.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return;
  updateDocument(document.filename, { title: trimmed });
  setIsEditingTitle(false);
};
```

Replace `handleDelete`:
```tsx
const handleDelete = (e: React.MouseEvent) => {
  e.stopPropagation();
  if (window.confirm(`Delete "${document.title}"?`)) {
    removeDocument(document.filename);
  }
  setMenuOpen(false);
};
```

- [ ] **Step 4: Update `FileRow.tsx` — read from DocumentsContext via props (no change needed if Sidebar passes the file correctly)**

Read `frontend-src/src/features/dashboard/components/Sidebar/FileRow.tsx` to confirm it already accepts an `onClick` prop and renders a file name. If it does, no changes are needed — `Sidebar/index.tsx` already calls `handleFileClick` which navigates to `/roadmap?pdfId=`. This will be fully updated in Batch C Task 4 when routing changes to `/roadmap/:documentId`.

- [ ] **Step 5: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend-src/src/features/dashboard/components/Sidebar/UploadModal.tsx frontend-src/src/features/dashboard/components/ReadingSection.tsx frontend-src/src/features/dashboard/components/ReadingCard.tsx
git commit -m "feat: wire UploadModal/ReadingSection/ReadingCard to DocumentsContext"
```

---

### Task 5: Update `ReadingCard` with progress bar UI

**Files:**
- Modify: `frontend-src/src/features/dashboard/components/ReadingCard.tsx`

- [ ] **Step 1: Add progress bar and progress text to grid and list view**

In `ReadingCard.tsx`, after the title/subtitle block (in both grid and list view), add the following progress section. Replace the subtitle `<p>` element:

**In grid view** — replace:
```tsx
<p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
  {document.subtitle}
</p>
```

With:
```tsx
{document.progress.percentage === 100 ? (
  <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 mt-1">
    ✓ Completed
  </span>
) : document.progress.percentage === 0 ? (
  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Not started</p>
) : (
  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
    {document.progress.completedLessons} of {document.progress.totalLessons} lessons · {document.progress.percentage}%
  </p>
)}
{document.progress.lastAccessedAt && document.progress.percentage > 0 && document.progress.percentage < 100 && (
  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
    Last opened {formatRelativeDate(document.progress.lastAccessedAt)}
  </p>
)}
```

At the bottom of the card (after the content div, before closing the card `<div>`), add the progress bar:
```tsx
{/* Progress bar at card bottom */}
{document.progress.totalLessons > 0 && (
  <div className="h-1 w-full bg-gray-100 dark:bg-gray-700">
    <div
      className="h-full rounded-full transition-all duration-500"
      style={{
        width: `${document.progress.percentage}%`,
        background: 'linear-gradient(to right, #3B82F6, #6366F1)',
      }}
    />
  </div>
)}
```

**In list view** — make the same substitution for the subtitle `<p>`.

- [ ] **Step 2: Add `formatRelativeDate` helper above the component**

Add this function ABOVE the `ReadingCard` component:
```tsx
function formatRelativeDate(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/features/dashboard/components/ReadingCard.tsx
git commit -m "feat: ReadingCard — progress bar, lesson count, last accessed, Completed badge"
```

---

### Task 6: Build `ProgressPage` with stats and SVG chart

**Files:**
- Create: `frontend-src/src/features/dashboard/components/ProgressStats.tsx`
- Create: `frontend-src/src/features/dashboard/components/LessonProgressChart.tsx`
- Modify: `frontend-src/src/features/dashboard/pages/ProgressPage.tsx`

- [ ] **Step 1: Create `ProgressStats.tsx`**

```tsx
interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 border border-black/5 dark:border-white/10 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-3xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

interface ProgressStatsProps {
  totalCompleted: number;
  documentsStarted: number;
  currentStreak: number;
  totalTimeHours: number;
}

export default function ProgressStats({ totalCompleted, documentsStarted, currentStreak, totalTimeHours }: ProgressStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard label="Lessons Completed" value={totalCompleted} icon="📚" color="#3B82F6" />
      <StatCard label="Documents Started" value={documentsStarted} icon="📁" color="#8B5CF6" />
      <StatCard label="Current Streak" value={`${currentStreak} days`} icon="🔥" color="#F97316" />
      <StatCard label="Time Spent" value={`${totalTimeHours}h`} icon="⏱️" color="#22C55E" />
    </div>
  );
}
```

- [ ] **Step 2: Create `LessonProgressChart.tsx`**

```tsx
interface LessonProgressChartProps {
  weekActivity: boolean[]; // 7 values: index 0 = 6 days ago, index 6 = today
  dailyCounts: number[];   // same ordering — count of lessons per day
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function LessonProgressChart({ weekActivity, dailyCounts }: LessonProgressChartProps) {
  const maxCount = Math.max(...dailyCounts, 1);
  const BAR_HEIGHT = 80; // max bar height in px

  // Compute day labels aligned to today
  const today = new Date();
  const labels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1];
  });

  return (
    <div className="bg-white dark:bg-[#1e293b] rounded-2xl p-5 border border-black/5 dark:border-white/10 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Lessons this week
      </h4>
      <div className="flex items-end gap-2 h-24">
        {dailyCounts.map((count, idx) => {
          const height = count > 0 ? Math.max(8, Math.round((count / maxCount) * BAR_HEIGHT)) : 4;
          const isToday = idx === 6;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{count > 0 ? count : ''}</span>
              <div
                className="w-full rounded-t-md transition-all duration-500"
                style={{
                  height: `${height}px`,
                  background: weekActivity[idx]
                    ? isToday
                      ? 'linear-gradient(to top, #3B82F6, #6366F1)'
                      : '#3B82F6'
                    : '#E5E7EB',
                }}
              />
              <span className={`text-[10px] font-medium ${isToday ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}>
                {labels[idx]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `ProgressPage.tsx`**

```tsx
import { useMemo } from 'react';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { useDocuments } from '../../../shared/contexts/DocumentsContext';
import ProgressStats from '../components/ProgressStats';
import LessonProgressChart from '../components/LessonProgressChart';
import { useNavigate } from 'react-router-dom';

export default function ProgressPage() {
  const { documentProgress, streak } = useProgressContext();
  const { documents } = useDocuments();
  const navigate = useNavigate();

  const totalCompleted = useMemo(
    () => Object.values(documentProgress).reduce((sum, d) => sum + d.completedLessons.length, 0),
    [documentProgress]
  );

  const documentsStarted = useMemo(
    () => Object.values(documentProgress).filter((d) => d.completedLessons.length > 0).length,
    [documentProgress]
  );

  const dailyCounts = useMemo((): number[] => {
    // Build day counts from completedAt timestamps in lessonProgress — approximated here via streak weekActivity booleans
    return streak.weekActivity.map((active) => (active ? 1 : 0));
  }, [streak.weekActivity]);

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Your Progress</h2>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: stats */}
        <div className="xl:col-span-1 space-y-4">
          <ProgressStats
            totalCompleted={totalCompleted}
            documentsStarted={documentsStarted}
            currentStreak={streak.currentStreak}
            totalTimeHours={0}
          />
        </div>

        {/* Center: chart */}
        <div className="xl:col-span-1">
          <LessonProgressChart weekActivity={streak.weekActivity} dailyCounts={dailyCounts} />
        </div>

        {/* Right: per-document list */}
        <div className="xl:col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Documents</h3>
          {documents.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">No documents yet. Upload a PDF to get started.</p>
          )}
          {documents.map((doc) => {
            const prog = documentProgress[doc.filename];
            const pct = prog?.percentage ?? 0;
            const done = prog?.completedLessons.length ?? 0;
            const total = prog?.totalLessons ?? 0;
            return (
              <div key={doc.filename} className="bg-white dark:bg-[#1e293b] rounded-xl p-4 border border-black/5 dark:border-white/10 shadow-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{doc.title}</p>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: 'linear-gradient(to right, #3B82F6, #6366F1)' }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{done}/{total} lessons</span>
                  {pct < 100 && (
                    <button
                      onClick={() => navigate(`/roadmap/${encodeURIComponent(doc.filename)}`)}
                      className="text-xs text-primary hover:text-primary-dark font-medium transition-colors"
                    >
                      Continue →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend-src/src/features/dashboard/components/ProgressStats.tsx frontend-src/src/features/dashboard/components/LessonProgressChart.tsx frontend-src/src/features/dashboard/pages/ProgressPage.tsx
git commit -m "feat: ProgressPage with stats cards, 7-day SVG bar chart, per-document progress list"
```

---

### Task 7: Enhance `StreakCard` with activity grid, animated flame, milestone messages

**Files:**
- Modify: `frontend-src/src/features/dashboard/components/StreakCard.tsx`

- [ ] **Step 1: Replace `StreakCard.tsx`**

```tsx
import { useProgressContext } from '../../../shared/contexts/ProgressContext';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function getMilestoneMessage(streak: number): string | null {
  if (streak >= 30) return '🏆 Monthly champion!';
  if (streak >= 14) return '🚀 Two weeks! You\'re unstoppable!';
  if (streak >= 7) return '💪 One week strong!';
  if (streak >= 3) return '🎯 You\'re on a roll!';
  return null;
}

export default function StreakCard() {
  const { streak } = useProgressContext();
  const { currentStreak, longestStreak, todayCompleted, weekActivity } = streak;

  const flameScale = Math.min(1.5, 1 + currentStreak * 0.02);
  const milestone = getMilestoneMessage(currentStreak);

  // Map weekActivity (index 0 = 6 days ago, index 6 = today) to Sun-Mon label order
  const today = new Date();
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    return DAY_LABELS[d.getDay()];
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div
          className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center"
          style={{ transform: `scale(${flameScale})`, transition: 'transform 0.5s ease' }}
        >
          <span className="text-2xl select-none">🔥</span>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Your Streak</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Keep it going!</p>
        </div>
      </div>

      {/* 7-day activity grid */}
      <div className="flex gap-1.5 mb-5">
        {weekActivity.map((active, idx) => {
          const isToday = idx === 6;
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full aspect-square rounded-full transition-colors duration-300 ${
                  active
                    ? 'bg-green-400 dark:bg-green-500'
                    : 'bg-gray-100 dark:bg-gray-700'
                } ${isToday ? 'ring-2 ring-offset-1 ring-orange-400 dark:ring-orange-500' : ''}`}
              />
              <span className="text-[9px] text-gray-400 dark:text-gray-500">{dayLabels[idx]}</span>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Streak</span>
          <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{currentStreak} days</span>
        </div>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Longest Streak</span>
          <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">{longestStreak} days</span>
        </div>

        {/* Today status */}
        {todayCompleted ? (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl">
            <p className="text-sm font-medium text-center text-green-700 dark:text-green-400">
              ✅ Today completed!
            </p>
          </div>
        ) : currentStreak > 0 ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
            <p className="text-sm font-medium text-center text-amber-700 dark:text-amber-400 mb-1">
              Streak lost — start again today!
            </p>
            <p className="text-xs text-center text-amber-600 dark:text-amber-500">
              Complete a lesson to restart
            </p>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
            <p className="text-sm font-medium text-center text-gray-600 dark:text-gray-400">
              ⏳ Complete today's reading
            </p>
          </div>
        )}

        {/* Milestone message */}
        {milestone && (
          <p className="text-xs text-center text-orange-500 dark:text-orange-400 font-medium px-2">
            {milestone}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Build to confirm no runtime errors**

```bash
cd .. && npm run build:frontend 2>&1 | tail -10
```

Expected: Build completes successfully.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/features/dashboard/components/StreakCard.tsx
git commit -m "feat: StreakCard — 7-day activity grid, animated flame scale, milestone messages, streak-lost state"
```
