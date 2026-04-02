# Batch C — PDF Thumbnail, Roadmap Loading Screen, Roadmap AI Data, Document Routing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PDF first-page thumbnail extraction via `pdfjs-dist`, build an animated roadmap loading screen, update `RoadmapPage` to fetch real AI lesson data and show loading/error states, and migrate the routing from `/roadmap?pdfId=` to `/roadmap/:documentId`.

**Architecture:** `pdfjs-dist` is the one approved new package. A shared `pdfThumbnail.ts` util handles canvas extraction. `RoadmapLoadingPage` is a self-contained fullscreen component. `RoadmapPage` switches between loading/ready/error states using a `loadingState` enum. The router change in Task 4 updates `router_index.tsx` and all navigation callsites.

**Tech Stack:** React 19, TypeScript 5.9 strict, Tailwind v4, pdfjs-dist (new), Framer Motion (already installed).

**Prerequisite:** Batch B must be complete before Batch C so `DocumentsContext` exists.

---

### Task 1: Install `pdfjs-dist` and create thumbnail utility

**Files:**
- Modify: `frontend-src/package.json` (via npm install)
- Create: `frontend-src/src/shared/utils/pdfThumbnail.ts`

- [ ] **Step 1: Install `pdfjs-dist`**

```bash
cd frontend-src && npm install pdfjs-dist
```

Expected: package installs without errors. `pdfjs-dist` appears in `package.json` dependencies.

- [ ] **Step 2: Create `frontend-src/src/shared/utils/pdfThumbnail.ts`**

```ts
import * as pdfjsLib from 'pdfjs-dist';

// Use the bundled worker from the package
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Extracts the first page of a PDF File as a base64 PNG data URL.
 * Returns null on failure.
 */
export async function extractPDFThumbnail(file: File, targetWidth = 400): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 1 });
    const scale = targetWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors. If `pdfjs-dist` types are missing, run `npm install --save-dev @types/pdfjs-dist` (only if needed).

- [ ] **Step 4: Commit**

```bash
git add frontend-src/package.json frontend-src/package-lock.json frontend-src/src/shared/utils/pdfThumbnail.ts
git commit -m "feat: install pdfjs-dist, add extractPDFThumbnail utility"
```

---

### Task 2: Show thumbnail preview in `UploadModal` and persist it in `DocumentsContext`

**Files:**
- Modify: `frontend-src/src/features/dashboard/components/Sidebar/UploadModal.tsx`

- [ ] **Step 1: Add thumbnail extraction to `UploadModal.tsx`**

Add the import at the top:
```tsx
import { extractPDFThumbnail } from '../../../../shared/utils/pdfThumbnail';
```

Add state inside the component (after existing state):
```tsx
const [thumbnail, setThumbnail] = useState<string | null>(null);
```

In `uploadFile`, before calling `pdfService.uploadPDF`, extract the thumbnail:
```tsx
// Extract thumbnail before upload (non-blocking — failure is silent)
const thumbDataUrl = await extractPDFThumbnail(file);
setThumbnail(thumbDataUrl);
```

After the `addDocument` call (from Batch B), pass the thumbnail:
```tsx
addDocument({
  id: Date.now(),
  filename: result.data.filename,
  title: result.data.originalFilename.replace(/\.pdf$/i, ''),
  subtitle: '',
  type: 'pdf',
  lastOpened: new Date().toISOString(),
  coverImage: thumbDataUrl,
  firstPageThumbnail: thumbDataUrl,
  progress: {
    completedLessons: 0,
    totalLessons: 0,
    percentage: 0,
    lastAccessedAt: null,
    streakDays: 0,
  },
});
```

Add thumbnail preview inside the drop zone (after the `<Upload>` icon block, before the file input):
```tsx
{thumbnail && !isUploading && (
  <div className="mt-4 mx-auto w-40 overflow-hidden rounded-lg shadow">
    <img src={thumbnail} alt="PDF preview" className="w-full object-cover" />
  </div>
)}
```

For pre-upload preview (when user picks a file but before upload starts), update `handleFileInput` and `handleDrop` to extract the thumbnail immediately when a file is selected, before the upload call:

Replace `handleFileInput`:
```tsx
const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    // Show preview immediately
    const preview = await extractPDFThumbnail(file);
    setThumbnail(preview);
    uploadFile(file);
  }
};
```

Replace `handleDrop`:
```tsx
const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  setDragActive(false);
  const file = e.dataTransfer.files?.[0];
  if (file) {
    const preview = await extractPDFThumbnail(file);
    setThumbnail(preview);
    uploadFile(file);
  }
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/dashboard/components/Sidebar/UploadModal.tsx
git commit -m "feat: UploadModal — show PDF first-page thumbnail preview before and after upload"
```

---

### Task 3: Create `RoadmapLoadingPage`

**Files:**
- Create: `frontend-src/src/features/roadmap/pages/RoadmapLoadingPage.tsx`

- [ ] **Step 1: Create `frontend-src/src/features/roadmap/pages/RoadmapLoadingPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTheme } from '../../../shared/contexts/ThemeContext';

const MESSAGES = [
  'Unfolding your learning adventure…',
  'Mapping the road ahead…',
  'AI is charting your path…',
  'Almost ready — big things take a moment…',
  'Turning pages into milestones…',
];

interface RoadmapLoadingPageProps {
  /** 0–100; jumps to 100 when API resolves */
  progress: number;
}

export default function RoadmapLoadingPage({ progress }: RoadmapLoadingPageProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [messageIdx, setMessageIdx] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  // Rotate messages every 2.5 s
  useEffect(() => {
    const id = setInterval(() => {
      setMessageIdx((i) => (i + 1) % MESSAGES.length);
    }, 2500);
    return () => clearInterval(id);
  }, []);

  // Animate progress bar smoothly toward the target
  useEffect(() => {
    const id = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= progress) return progress;
        return Math.min(prev + 1, progress);
      });
    }, 80);
    return () => clearInterval(id);
  }, [progress]);

  const bg = isDark ? '#0f172a' : '#F4F4F4';
  const card = isDark ? '#1e293b' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const textPrimary = isDark ? '#F1F5F9' : '#111827';
  const textMuted = isDark ? '#94A3B8' : '#6B7280';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: bg, fontFamily: 'Poppins, sans-serif' }}
    >
      {/* Header */}
      <header
        className="shrink-0 flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: border, backgroundColor: card }}
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-32 rounded-md animate-pulse" style={{ backgroundColor: isDark ? '#2d3748' : '#E5E7EB' }} />
        </div>
        <div className="flex-1 mx-8 h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#2d3748' : '#E5E7EB' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${displayProgress}%`, background: 'linear-gradient(to right, #3B82F6, #6366F1)' }}
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-colors"
            style={{ color: textMuted }}
            aria-label="Toggle theme"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: textMuted }}
            aria-label="Close roadmap"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Main loading area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
        {/* Animated SVG road */}
        <svg width="260" height="80" viewBox="0 0 260 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M10 60 C70 60 80 20 130 20 C180 20 190 60 250 60"
            stroke={isDark ? '#253550' : '#CBD5E1'}
            strokeWidth="16"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M10 60 C70 60 80 20 130 20 C180 20 190 60 250 60"
            stroke="url(#roadGrad)"
            strokeWidth="14"
            strokeLinecap="round"
            fill="none"
            strokeDasharray="280"
            strokeDashoffset={280 - (displayProgress / 100) * 280}
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
          <defs>
            <linearGradient id="roadGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
          {/* Pin markers */}
          {[
            { cx: 40, cy: 58, color: '#EF4444' },
            { cx: 100, cy: 30, color: '#F97316' },
            { cx: 130, cy: 20, color: '#22C55E' },
            { cx: 160, cy: 30, color: '#3B82F6' },
            { cx: 220, cy: 58, color: '#8B5CF6' },
          ].map((pin, i) => (
            <g key={i}>
              <circle cx={pin.cx} cy={pin.cy} r="8" fill={pin.color} opacity={displayProgress > i * 20 ? 1 : 0.2}
                style={{ transition: 'opacity 0.4s ease' }} />
              <circle cx={pin.cx} cy={pin.cy} r="3" fill="white" opacity={displayProgress > i * 20 ? 1 : 0.1}
                style={{ transition: 'opacity 0.4s ease' }} />
            </g>
          ))}
        </svg>

        {/* Progress percentage */}
        <p className="text-4xl font-bold" style={{ color: textPrimary }}>{displayProgress}%</p>

        {/* Rotating message */}
        <p
          key={messageIdx}
          className="text-base font-medium text-center max-w-xs animate-pulse"
          style={{ color: textMuted }}
        >
          {MESSAGES[messageIdx]}
        </p>
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

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/roadmap/pages/RoadmapLoadingPage.tsx
git commit -m "feat: RoadmapLoadingPage — animated SVG road, rotating messages, gradient progress bar"
```

---

### Task 4: Update `RoadmapPage` — new types, loading/error states, AI data fetch

**Files:**
- Modify: `frontend-src/src/features/roadmap/types/index.ts`
- Modify: `frontend-src/src/features/roadmap/pages/RoadmapPage.tsx`

- [ ] **Step 1: Replace `frontend-src/src/features/roadmap/types/index.ts`**

```ts
export interface RoadmapLesson {
  id: string;
  title: string;
  pageStart?: number;
  pageEnd?: number;
  estimatedMinutes: number;
  isCompleted: boolean;
  isCurrent: boolean;
  durationMin: number;
}

export interface Module {
  id: string;
  title: string;
  chapter: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  percentage: number;
  lessonsCompleted: number;
  totalLessons: number;
  lessons: RoadmapLesson[];
  pinColor: string;
  pinEmoji: string;
  description?: string;
  pageStart?: number;
  pageEnd?: number;
  estimatedMinutes?: number;
}
```

- [ ] **Step 2: Update `RoadmapPage.tsx` — add loading/error states and fetch from `pdfService`**

At the top of `RoadmapPage.tsx`, the existing imports include `useSearchParams`, `useAuth`, `pdfService`. **Replace** those three import lines with:
```tsx
import { useParams } from 'react-router-dom';
import { useAuth } from '../../../shared/contexts/AuthContext';
import * as pdfService from '../../../shared/services/pdfService';
import type { BackendLesson } from '../../../shared/services/pdfService';
import RoadmapLoadingPage from './RoadmapLoadingPage';
```

Note: `useSearchParams` is replaced with `useParams` because in Task 5 below the route changes to `/roadmap/:documentId`. The `pdfId` comes from `useParams` now.

Inside the `RoadmapPage` component, replace the existing state/fetch block (the block that starts with `const [searchParams] = useSearchParams();`):
```tsx
const { documentId } = useParams<{ documentId: string }>();
const { user } = useAuth();

type LoadingState = 'loading' | 'ready' | 'error';
const [loadingState, setLoadingState] = useState<LoadingState>(documentId ? 'loading' : 'ready');
const [loadingProgress, setLoadingProgress] = useState(0);
const [modules, setModules] = useState<Module[]>(MODULES);

useEffect(() => {
  if (!documentId) {
    setLoadingState('ready');
    return;
  }

  let progressTimer: ReturnType<typeof setInterval>;
  setLoadingState('loading');
  setLoadingProgress(0);

  // Fake progress up to 95% while waiting
  progressTimer = setInterval(() => {
    setLoadingProgress((prev) => (prev < 95 ? prev + 1 : prev));
  }, 85);

  const fetchLessons = async () => {
    let result = await pdfService.getLessons(documentId);
    if (!result.success && user?.id) {
      result = await pdfService.generateLessons(documentId, user.id);
    }

    clearInterval(progressTimer);
    setLoadingProgress(100);

    // Small delay so user sees 100% before fade
    await new Promise((r) => setTimeout(r, 400));

    if (result.success && result.data) {
      setModules(mapLessonsToModules(result.data.lessons, result.data.title));
      setLoadingState('ready');
    } else {
      setLoadingState('error');
    }
  };

  fetchLessons().catch(() => {
    clearInterval(progressTimer);
    setLoadingState('error');
  });

  return () => clearInterval(progressTimer);
}, [documentId, user?.id]);
```

In the `return (` of `RoadmapPage`, at the very top, add the conditional rendering before the existing JSX:
```tsx
if (loadingState === 'loading') {
  return <RoadmapLoadingPage progress={loadingProgress} />;
}

if (loadingState === 'error') {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0f172a]">
      <p className="text-white text-xl font-semibold mb-2">Could not load roadmap</p>
      <p className="text-white/60 text-sm mb-6">The AI couldn't generate lessons for this document.</p>
      <button
        onClick={() => { setLoadingState('loading'); setLoadingProgress(0); }}
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition"
      >
        Retry
      </button>
    </div>
  );
}
```

Also remove the old `isLoadingLessons` overlay `{isLoadingLessons && ...}` block if it exists (it was added in the backend integration plan).

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/features/roadmap/types/index.ts frontend-src/src/features/roadmap/pages/RoadmapPage.tsx
git commit -m "feat: RoadmapPage — loading/error states, animated progress, fetch via useParams documentId"
```

---

### Task 5: Migrate routing to `/roadmap/:documentId`, update all navigation callsites

**Files:**
- Modify: `frontend-src/src/app/router/router_index.tsx`
- Modify: `frontend-src/src/features/dashboard/components/Sidebar/index.tsx`
- Modify: `frontend-src/src/features/dashboard/pages/ProgressPage.tsx` (already uses new path in Batch B)

- [ ] **Step 1: Update `router_index.tsx` — change `/roadmap` to `/roadmap/:documentId`**

In `frontend-src/src/app/router/router_index.tsx`, find the roadmap route:
```tsx
{
  path: "/roadmap",
  element: (
    <ProtectedRoute>
      <RoadmapPage />
    </ProtectedRoute>
  ),
},
```

Replace with:
```tsx
{
  path: "/roadmap/:documentId",
  element: (
    <ProtectedRoute>
      <RoadmapPage />
    </ProtectedRoute>
  ),
},
```

- [ ] **Step 2: Update `Sidebar/index.tsx` — navigate to `/roadmap/:documentId`**

In `Sidebar/index.tsx`, find `handleFileClick`:
```tsx
const handleFileClick = (file: UploadedFile) => {
  navigate(`/roadmap?pdfId=${encodeURIComponent(file.filename)}`);
};
```

Replace with:
```tsx
const handleFileClick = (file: UploadedFile) => {
  navigate(`/roadmap/${encodeURIComponent(file.filename)}`);
};
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Build**

```bash
cd .. && npm run build:frontend 2>&1 | tail -10
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend-src/src/app/router/router_index.tsx frontend-src/src/features/dashboard/components/Sidebar/index.tsx
git commit -m "feat: migrate roadmap route to /roadmap/:documentId, update all navigation callsites"
```
