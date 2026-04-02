# Docvia Frontend — Implementation Prompt for Claude Code

## MANDATORY FIRST STEP
Read `CLAUDE.md` at the project root in full before touching any file.
It contains the design system, routing rules, coding standards, and all
architectural decisions made in previous sessions. Violating anything in
CLAUDE.md is not acceptable.

---

## Project Context Summary

**Docvia** is a React 19 + TypeScript + Tailwind v4 + Vite app.
Font: Poppins everywhere. No Three.js. No new packages without justification.
Dark mode is class-based (ThemeContext). All data is currently mocked.
The backend exists but integration is pending — keep mocks in place, wire up
API calls using the service layer in `src/shared/services/` and
`src/shared/config/api.config.ts`. See CLAUDE.md §10 for all endpoints.

---

## Tasks — Implement All of the Following

---

### TASK 1 — Document Cover Image from PDF First Page

**Files:** `src/features/dashboard/components/ReadingCard.tsx`,
`src/features/dashboard/components/Sidebar/UploadModal.tsx`

When a PDF is uploaded:
- Extract the first page as a thumbnail image using the Canvas API
  (`PDF.js` via CDN or `import` — this is the ONE approved new package:
  `pdfjs-dist`. Add it to `package.json`).
- Store the base64 thumbnail in the document object.
- Display it as the `coverImage` in `ReadingCard.tsx` instead of the
  placeholder SVG.
- In `UploadModal.tsx`, show a small preview of the extracted first-page
  thumbnail after the user selects a file, before confirming upload.

**Type update required in** `src/features/dashboard/types/index.ts`:
```ts
interface DocumentItem {
  // add:
  coverImage: string | null;  // base64 data URL
  firstPageThumbnail: string | null;
}
```

---

### TASK 2 — Document Card & File Browser Navigate to Roadmap

**Files:** `src/features/dashboard/components/ReadingCard.tsx`,
`src/features/dashboard/components/Sidebar/FileRow.tsx`

- Clicking "Open" on a `ReadingCard` (three-dot menu) OR clicking a file
  in the sidebar `FileRow` must navigate to `/roadmap/:documentId`.
- Pass the document ID as a URL param.
- Update the router in `src/app/router/index.tsx`:
  ```
  /roadmap/:documentId  →  RoadmapPage  (NO DashboardLayout)
  ```
- `RoadmapPage` must read `useParams()` to get `documentId` and fetch/mock
  the roadmap data for that specific document.
- The old static `/roadmap` route must be REMOVED. The roadmap is only
  accessible via a specific document.

---

### TASK 3 — Roadmap Generation Loading Screen

**New file:** `src/features/roadmap/pages/RoadmapLoadingPage.tsx`

When navigating to `/roadmap/:documentId`, before the roadmap is ready,
show a full-screen animated loading page that:

1. Has the same header as the roadmap (progress bar area shows skeleton,
   close/X button works).
2. Shows a centered animation — use a CSS-animated SVG road being "drawn"
   progressively (stroke-dashoffset animation), or a pulsing roadmap
   skeleton.
3. Displays a rotating set of motivational messages that cycle every 2.5s:
   ```
   "Unfolding your learning adventure…"
   "Mapping the road ahead…"
   "AI is charting your path…"
   "Almost ready — big things take a moment…"
   "Turning pages into milestones…"
   ```
4. Shows a progress bar that fills from 0% to 95% over ~8 seconds
   (fake progress), then jumps to 100% when the API resolves.
5. Supports both light and dark mode (use dashboard theme tokens from
   CLAUDE.md §5.2).
6. On completion, transitions to `RoadmapPage` using a fade-in animation.

**Logic:** In `RoadmapPage.tsx`, implement a `loadingState`:
- `'loading'` → render `RoadmapLoadingPage`
- `'ready'`   → render the actual roadmap canvas
- `'error'`   → render an error state with retry button

Simulate a 3-5 second mock delay for now. Wire to the real API endpoint
`GET /api/roadmap/:documentId` when backend is ready.

---

### TASK 4 — Search Bar: Filterable and Functional

**File:** `src/features/dashboard/components/TopBar.tsx`,
`src/features/dashboard/pages/DashboardPage.tsx`,
`src/features/dashboard/components/ReadingSection.tsx`

The search bar must:
1. Be controlled — lift `searchTerm` state up to `DashboardPage` and pass
   it as a prop to `ReadingSection`.
2. Filter documents in real-time (debounce 300ms using `useEffect` and
   `setTimeout`/`clearTimeout` — no new packages) by:
   - Document title (case-insensitive)
   - Document subtitle/description
   - Document type (`book` | `report`)
3. Show a "No results for '{term}'" empty state with a clear button.
4. Show a small animated search results count: "Showing 3 of 8 documents"
   when a filter is active.
5. Add a clear (x) button inside the input that appears when there is text.
6. Keyboard shortcut: `Escape` clears the search.
7. Validate: trim whitespace, ignore searches under 1 character.

---

### TASK 5 — Reading Card: Show User Progress Instead of Description

**File:** `src/features/dashboard/components/ReadingCard.tsx`,
`src/features/dashboard/types/index.ts`

Replace the `subtitle` text on the card with a progress indicator.

**Type update:**
```ts
interface DocumentItem {
  progress: {
    completedLessons: number;
    totalLessons: number;
    percentage: number;
    lastAccessedAt: string | null;  // ISO string
    streakDays: number;
  };
}
```

**Card display (both grid and list view):**
- A thin progress bar (height 4px) at the bottom of the card colored
  `#3B82F6 to #6366F1` gradient.
- Below the title: `"3 of 12 lessons · 25%"` in small muted text.
- If `lastAccessedAt` is set: `"Last opened 2 days ago"` in even smaller
  muted text.
- If `percentage === 100`: show a green `Completed` badge instead.
- If `percentage === 0`: show `"Not started"` in muted text.

---

### TASK 6 — Progress Feature Implementation

**New files:**
- `src/features/dashboard/pages/ProgressPage.tsx` (replace placeholder)
- `src/features/dashboard/components/ProgressStats.tsx`
- `src/features/dashboard/components/LessonProgressChart.tsx`
- `src/shared/contexts/ProgressContext.tsx`
- `src/shared/hooks/useProgress.ts`

**Architecture — use React Context for progress state:**

```ts
// src/shared/contexts/ProgressContext.tsx
interface LessonProgress {
  lessonId: string;
  documentId: string;
  isCompleted: boolean;
  completedAt: string | null;
  timeSpentSeconds: number;
  attempts: number;
}

interface DocumentProgress {
  documentId: string;
  completedLessons: string[];
  currentLessonId: string | null;
  totalLessons: number;
  percentage: number;
  startedAt: string;
  lastAccessedAt: string;
  streakDays: number;
}

interface ProgressContextType {
  documentProgress: Record<string, DocumentProgress>;
  lessonProgress: Record<string, LessonProgress>;
  markLessonComplete: (documentId: string, lessonId: string) => void;
  setCurrentLesson: (documentId: string, lessonId: string) => void;
  getDocumentProgress: (documentId: string) => DocumentProgress | null;
}
```

Persist to `localStorage` under key `'docvia-progress'`.
Expose via `useProgress()` hook.
Wrap `App.tsx` with `<ProgressProvider>` alongside `<ThemeProvider>`.

**ProgressPage layout (replace placeholder):**
- Left column: overall stats cards — Total lessons completed, Documents
  started, Total time spent, Current streak.
- Center: A bar chart (pure SVG/CSS, no chart library) showing lessons
  completed per day for the last 7 days.
- Right: Per-document progress list — each document with its progress bar,
  `X/Y lessons`, and "Continue" button.
- All responsive, full dark/light mode support.

**API wiring:** `GET /api/progress` and `POST /api/progress/lesson/:lessonId`
— add to `api.config.ts`, call from `ProgressContext`.

---

### TASK 7 — Streak Feature (Gamification)

**Files:** `src/features/dashboard/components/StreakCard.tsx`,
`src/shared/contexts/ProgressContext.tsx`

Enhance the existing `StreakCard` component:

1. **Streak calculation** (in `ProgressContext`):
   - A streak increments when the user completes at least one lesson per
     calendar day.
   - A streak breaks if no lesson is completed by midnight.
   - Persist streak start date and last active date in `localStorage`.
   - Expose `currentStreak`, `longestStreak`, `todayCompleted`,
     `weekActivity: boolean[]` (last 7 days).

2. **StreakCard UI enhancements:**
   - 7-day activity grid — a row of 7 circles, filled green if active,
     gray if missed, pulsing orange ring on today.
   - Animated flame that grows in size based on streak length
     (CSS scale transform: `scale(1 + streak * 0.02)`, capped at 1.5).
   - Milestone messages:
     - 3 days: "You're on a roll!"
     - 7 days: "One week strong!"
     - 14 days: "Two weeks! You're unstoppable!"
     - 30 days: "Monthly champion!"
   - If streak is broken: show "Streak lost — start again today!" in a
     gentle amber warning, with a "Restart" CTA.

---

### TASK 8 — Auth Pages: Fix Dark/Light Mode Color Contrast

**Files:** All files in `src/features/auth/pages/` and
`src/features/auth/components/`

**Problems to fix:**
1. Auth pages currently ignore ThemeContext — the background is always
   light gray regardless of system/user preference.
2. Input fields have `bg-white` hardcoded — invisible in dark mode.
3. Card borders are invisible in dark mode.
4. "Forgot password?" link has insufficient contrast.
5. The OR divider text has poor contrast in both modes.

**Fix requirements:**
- Wrap auth page backgrounds with `useTheme()`.
- Light mode: `bg-[#F5F5F5]` page, `bg-white` card, `border-gray-100`.
- Dark mode: `dark:bg-[#0f172a]` page, `dark:bg-[#1e293b]` card,
  `dark:border-white/10`.
- Input component `src/shared/components/ui/Input.tsx`:
  - Light: `bg-white border-gray-200 text-gray-900 placeholder:text-gray-400`
  - Dark: `dark:bg-[#0f172a] dark:border-white/10 dark:text-gray-100 dark:placeholder:text-gray-500`
- All text must meet WCAG AA contrast (4.5:1 minimum ratio).
- Test every auth page in both modes before marking done.

---

### TASK 9 — Google OAuth on Auth Pages

**Files:** `src/features/auth/pages/SignInPage.tsx`,
`src/features/auth/pages/SignUpPage.tsx`,
`src/features/auth/components/SignInForm.tsx`,
`src/features/auth/components/SignUpForm.tsx`

Add a "Continue with Google" button:

**Placement (UX-recommended):**
- Position it ABOVE the email/password fields, separated by an
  `OR` divider below it.
- This is the standard Google-first pattern used by modern apps.

**Button design:**
- White background, Google logo SVG (inline, 4-color G), "Continue with Google" text
- `border: 1px solid #dadce0` (light) / `rgba(255,255,255,0.12)` (dark)
- `hover: subtle bg-gray-50` / `dark:bg-white/5`
- `height: h-12, rounded-xl, full width`

Use the inline 4-color Google SVG — do not use an external image or CDN.

**Wiring:**
- `onClick` calls `loginWithGoogle()` from `useAuth()` context.
- Show a loading spinner inside the button while the redirect is pending.
- Handle errors — display inline error message below the button if
  `loginWithGoogle()` throws.
- The `AuthContext` already has `loginWithGoogle()` wired to
  `authService.getGoogleAuthUrl()`. Do NOT change the service layer.

---

### TASK 10 — Comprehensive Input Validation

**Scope:** Every form input across the entire app.

**Apply to:**
- `SignInForm.tsx` — email format, password min 8 chars
- `SignUpForm.tsx` — email format, username 3-30 chars alphanumeric+underscore,
  password min 8 chars + 1 uppercase + 1 number, confirmPassword match,
  agreeToTerms must be checked
- `ForgotPasswordForm.tsx` — email format
- `CreateNewPasswordPage.tsx` — password strength, confirm match
- `UploadModal.tsx` — file type must be PDF, max size 50MB, filename
  must not be empty
- `TopBar.tsx` search — trim, min 1 char to trigger filter
- `ReadingCard.tsx` inline title edit — min 1 char, max 100 chars,
  no leading/trailing spaces

**Validation rules:**
```ts
// Email:    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Password: length>=8, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/
// Username: /^[a-zA-Z0-9_]{3,30}$/
// File:     file.type === 'application/pdf' && file.size <= 52_428_800
```

**UX rules for error display:**
- Show errors BELOW the relevant input, never in a top banner.
- Use `text-red-500 text-xs mt-1` for error text.
- Errors clear when the user starts typing in that field.
- Submit button stays enabled — show errors on click (disabled buttons
  confuse users who don't understand why they can't submit).
- Password field: show a strength meter (Weak / Medium / Strong) as the
  user types, using a colored 3-segment bar.

---

### TASK 11 — Fix Roadmap: AI-Generated Titles from PDF

**File:** `src/features/roadmap/pages/RoadmapPage.tsx`,
`src/features/roadmap/types/index.ts`

The roadmap must display data from the backend AI segmentation, not
hardcoded mock data.

1. `RoadmapPage` receives `documentId` from `useParams()`.
2. On mount, call `GET /api/roadmap/:documentId` — add to `api.config.ts`.
3. Expected API response shape:
```ts
interface RoadmapData {
  documentId: string;
  documentTitle: string;
  totalLessons: number;
  completedLessons: number;
  modules: RoadmapModule[];
}
interface RoadmapModule {
  id: string;
  title: string;          // EXACT title from AI — never truncate without ellipsis
  description: string;    // AI-generated summary of this section
  chapter: number;
  pageStart: number;
  pageEnd: number;
  estimatedMinutes: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  percentage: number;
  lessons: RoadmapLesson[];
}
interface RoadmapLesson {
  id: string;
  title: string;          // EXACT title from AI
  pageStart: number;
  pageEnd: number;
  estimatedMinutes: number;
  isCompleted: boolean;
  isCurrent: boolean;
}
```
4. While loading: render `RoadmapLoadingPage` (from Task 3).
5. On API failure: show error state with Retry button.
6. Module/lesson titles render as-is from API, wrapped with CSS ellipsis
   only if they overflow — never truncated in JavaScript.
7. Map pin colors cycle through the defined palette regardless of how
   many modules exist.

---

### TASK 12 — Reading Segment: Click Node Opens Reader

**New files:**
- `src/features/reader/pages/ReaderPage.tsx`
- `src/features/reader/components/PDFViewer.tsx`
- `src/features/reader/components/AIChatPanel.tsx`
- `src/features/reader/components/DeepDivePanel.tsx`
- `src/features/reader/components/ReaderToolbar.tsx`

**Route:** Add `/reader/:documentId/:lessonId` to the router.
Fullscreen, no `DashboardLayout`.

**Behavior:** Clicking an unlocked lesson node/pin on the roadmap
navigates to `/reader/:documentId/:lessonId`.

**ReaderPage layout:**
```
┌─────────────────────────────────────────────────────┐
│ ReaderToolbar (fixed top bar)                        │
│  [Back to Roadmap]  [Doc Title > Lesson Name]        │
│  [Prev Lesson] [Next Lesson]  [Mark Complete]        │
├──────────────────────┬──────────────────────────────┤
│                      │                              │
│   PDFViewer          │   Right Panel (collapsible)  │
│   (scrollable,       │   Tabs: AI Chat / Deep Dive  │
│    70% width)        │        / Notes / Summary     │
│                      │   (30% width)                │
│                      │                              │
└──────────────────────┴──────────────────────────────┘
```

**PDFViewer:**
- Uses `pdfjs-dist` (approved in Task 1) to render the PDF.
- Opens to `lesson.pageStart` automatically on mount.
- Page navigation: prev/next page buttons, page number input field.
- Zoom in/out controls.
- Text selection enabled.

**AIChatPanel (AI Chat tab):**
- Chat interface — scrollable message list + input box pinned to bottom.
- Sends `POST /api/ai/chat` with `{ documentId, lessonId, message, context }`.
- Show a typing indicator (animated dots) while awaiting response.
- Messages stored in component state — not persisted between sessions for now.
- Starter prompt chips shown when conversation is empty:
  - "Explain this section in simple terms"
  - "Give me a quiz on this lesson"
  - "What are the key takeaways?"

**DeepDivePanel (Deep Dive tab):**
- Calls `GET /api/ai/deep-dive/:lessonId` on tab activation.
- Displays AI-generated breakdown in sections:
  Key Concepts / Examples / Common Mistakes / Further Reading.
- Show skeleton loaders while fetching.

**ReaderToolbar — Mark Complete:**
- "Mark as Complete" button calls `ProgressContext.markLessonComplete()`.
- On click: brief confetti/celebration animation (reuse `ConfettiOverlay`
  from `src/features/roadmap/components/ConfettiOverlay.tsx`).
- After 1.5s, navigate back to `/roadmap/:documentId`.

**Design reference:** The existing `frontend/index.html` in the project
root contains the original HTML-based reader UI. Use it as a reference
for feature scope and layout patterns, but reimplement fully in React
following Docvia's design system (Poppins, theme tokens from CLAUDE.md §5).

---

### TASK 13 — Per-User Document Storage

**Files:**
`src/features/dashboard/components/Sidebar/index.tsx`,
`src/features/dashboard/components/ReadingSection.tsx`,
`src/features/dashboard/components/Sidebar/UploadModal.tsx`

**This task requires these backend endpoints:**
```
GET    /api/documents              — list authenticated user's documents
POST   /api/documents/upload       — upload a PDF (multipart/form-data)
DELETE /api/documents/:id          — delete a document
PATCH  /api/documents/:id          — update title or metadata
GET    /api/documents/:id          — get single document metadata
```

If these endpoints are NOT yet available, implement a
`DocumentsContext` at `src/shared/contexts/DocumentsContext.tsx` that:
- Stores documents in `localStorage` under `'docvia-documents-{userId}'`.
- Keys documents by `userId` (from `AuthContext`) so users never see
  each other's documents.
- Provides: `documents`, `addDocument`, `removeDocument`, `updateDocument`,
  `isLoading`.
- When the backend is ready, swap `localStorage` for real API calls inside
  the context only — zero changes needed in consuming components.

**Wire up:**
1. `UploadModal` calls `addDocument()` from `DocumentsContext` on success.
2. `ReadingSection` reads from `DocumentsContext`, not the mock array.
3. Sidebar `FileRow` reads from `DocumentsContext`.
4. `ReadingCard` Delete calls `removeDocument()`.
5. Inline title edit calls `updateDocument()`.

---

## Constraints and Quality Gates

Before considering any task done, verify each of the following:

- [ ] TypeScript compiles with zero errors (`tsc --noEmit`)
- [ ] ESLint passes (`npm run lint`) — fix all warnings, not just errors
- [ ] Both light AND dark mode look correct for every changed component
- [ ] Every new component uses Poppins font
- [ ] No `any` types introduced anywhere
- [ ] No new packages added beyond `pdfjs-dist` (approved in Task 1)
- [ ] All mock data preserved — nothing hardcoded is deleted, only made
      dynamic via context or API
- [ ] Routes are consistent with CLAUDE.md §4
- [ ] Responsive: dashboard components are mobile-first, roadmap and reader
      use `md:` breakpoint for desktop layout
- [ ] CLAUDE.md §9 (Known Issues) is updated when a task is completed

---

## Implementation Order (Recommended)

Tackle in this sequence to avoid blocking dependencies:

1. **Task 8** — auth dark mode fix (quick win, no dependencies)
2. **Task 10** — validation (quick win, improves all forms)
3. **Task 9** — Google OAuth UI (builds on Task 8)
4. **Task 4** — search bar (self-contained)
5. **Task 13** — DocumentsContext (needed by Tasks 2, 5, 6)
6. **Task 5** — card progress UI (needs DocumentsContext)
7. **Task 6** — ProgressContext and ProgressPage (core data layer)
8. **Task 7** — streak (builds on ProgressContext)
9. **Task 1** — PDF thumbnail (install pdfjs-dist first)
10. **Task 3** — loading screen (standalone new component)
11. **Task 11** — roadmap AI data (needs loading screen)
12. **Task 2** — document to roadmap routing (needs Task 11)
13. **Task 12** — ReaderPage (final, depends on routing and progress)

---

## Notes for Claude Code

- When creating a new context, always wrap it in `App.tsx` in the correct
  order: `ThemeProvider` outermost, then `AuthProvider`, then
  `ProgressProvider`, then `DocumentsProvider` innermost.
- The `cn()` utility is at `src/shared/utils/cn.ts` — always use it for
  conditional Tailwind classes.
- Never hardcode colors — use CSS variables from CLAUDE.md §5.1 or inline
  `isDark` ternaries matching CLAUDE.md §5.2 tokens exactly.
- The `frontend/index.html` mentioned in Task 12 refers to an existing
  file in the project root with the original HTML-based UI. Read it for
  reference — extract patterns but do NOT import or embed it directly.
- When unsure about a design decision, refer to CLAUDE.md §5 and match
  the existing dashboard aesthetic.
- Update `CLAUDE.md` §9 when a task is completed to keep project memory
  current for future sessions.