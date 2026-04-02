# Batch D — ReaderPage (PDF Viewer, Text Selection, AI Chat, Quiz, Deep Dive)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full fullscreen reader at `/reader/:documentId/:lessonId` with a PDF viewer (pdfjs-dist), floating text-selection tooltip with dictionary lookup, AI chat with follow-up chips, a configurable quiz/microtask panel, a deep dive panel, and lesson progress persistence.

**Architecture:** New feature folder `src/features/reader/`. Six focused component files + one service file. `ReaderPage` is the layout shell. Right panel has 4 tabs (Chat, Quiz, Deep Dive, Notes). Text selection is handled by a global `mouseup` listener that positions a floating `TextSelectionTooltip`. All API calls go through `readerService.ts`. No new packages beyond `pdfjs-dist` (already installed in Batch C).

**API endpoints used:**
- `POST /api/pdf/chat` — AI chat
- `POST /api/pdf/microtask/generate` — generate quiz questions
- `POST /api/pdf/microtask/evaluate` — evaluate quiz answer
- `POST /api/pdf/lessons/deep-explain` — deep dive explanation
- `GET  /api/pdf/progress/:pdfId?userId=` — load which lessons are done
- `POST /api/pdf/progress` — save completed lesson

**Tech Stack:** React 19, TypeScript 5.9 strict, Tailwind v4, pdfjs-dist (Batch C), Framer Motion (installed).

**Prerequisite:** Batches B and C must be complete.

---

### Task 1: Add route and create `readerService.ts`

**Files:**
- Modify: `frontend-src/src/app/router/router_index.tsx`
- Create: `frontend-src/src/features/reader/services/readerService.ts`

- [ ] **Step 1: Add `/reader/:documentId/:lessonId` route to `router_index.tsx`**

Add the import at the top of `router_index.tsx`:
```tsx
import ReaderPage from '../../features/reader/pages/ReaderPage';
```

Add the route inside the `createBrowserRouter` array (after the roadmap route):
```tsx
{
  path: "/reader/:documentId/:lessonId",
  element: (
    <ProtectedRoute>
      <ReaderPage />
    </ProtectedRoute>
  ),
},
```

- [ ] **Step 2: Create `frontend-src/src/features/reader/services/readerService.ts`**

```ts
const BASE = '/api/pdf';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  success: boolean;
  reply?: string;
  error?: string;
}

export interface MicrotaskQuestion {
  type: 'multiple_choice' | 'true_false' | 'identification' | 'essay' | 'short_answer';
  question: string;
  options: string[];             // for MC / T-F
  correctAnswer?: string;
  hint?: string;
  explanation?: string;
}

export interface MicrotaskGenerateResult {
  success: boolean;
  tasks?: MicrotaskQuestion[];
  error?: string;
}

export interface MicrotaskEvaluateResult {
  success: boolean;
  isCorrect?: boolean;
  feedback?: string;
  correctAnswer?: string;
  error?: string;
}

export interface DeepExplainResult {
  success: boolean;
  keyConcepts?: string;
  examples?: string;
  commonMistakes?: string;
  furtherReading?: string;
  error?: string;
}

export interface ProgressResult {
  success: boolean;
  completedIds?: number[];
  error?: string;
}

export async function sendChat(
  pdfId: string,
  lessonTitle: string,
  lessonContent: string,
  question: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfId, segmentTitle: lessonTitle, segmentContent: lessonContent, question, history }),
  });
  return res.json();
}

export async function generateQuiz(
  segmentTitle: string,
  segmentContent: string,
  documentTitle: string,
  taskType: string,
  count: number,
  previousQuestions: string[]
): Promise<MicrotaskGenerateResult> {
  const res = await fetch(`${BASE}/microtask/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segmentTitle, segmentContent, documentTitle, taskType, count, previousQuestions }),
  });
  return res.json();
}

export async function evaluateAnswer(
  question: string,
  userAnswer: string,
  correctAnswer: string,
  questionType: string
): Promise<MicrotaskEvaluateResult> {
  const res = await fetch(`${BASE}/microtask/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, userAnswer, correctAnswer, questionType }),
  });
  return res.json();
}

export async function deepExplain(
  pdfId: string,
  lessonId: string,
  lessonTitle: string,
  lessonContent: string
): Promise<DeepExplainResult> {
  const res = await fetch(`${BASE}/lessons/deep-explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfId, lessonId, lessonTitle, lessonContent }),
  });
  return res.json();
}

export async function loadProgress(pdfId: string, userId: string): Promise<ProgressResult> {
  const res = await fetch(
    `${BASE}/progress/${encodeURIComponent(pdfId)}?userId=${encodeURIComponent(userId)}`
  );
  return res.json();
}

export async function saveProgress(
  pdfId: string,
  userId: string,
  lessonId: string,
  token: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pdfId, userId, lessonId }),
  });
  return res.json();
}

export async function fetchDictionary(word: string): Promise<{ word: string; pos: string; def: string } | null> {
  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return null;
    const entry = data[0];
    const m = (entry.meanings || [])[0];
    if (!m) return null;
    const def = m.definitions?.[0]?.definition ?? '';
    if (!def) return null;
    return { word: entry.word, pos: m.partOfSpeech ?? '', def };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/app/router/router_index.tsx frontend-src/src/features/reader/services/readerService.ts
git commit -m "feat: add /reader/:documentId/:lessonId route, create readerService with all API calls"
```

---

### Task 2: Create `ReaderToolbar`

**Files:**
- Create: `frontend-src/src/features/reader/components/ReaderToolbar.tsx`

- [ ] **Step 1: Create `frontend-src/src/features/reader/components/ReaderToolbar.tsx`**

```tsx
import { ChevronLeft, ChevronRight, CheckCircle, Moon, Sun, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../shared/contexts/ThemeContext';

interface ReaderToolbarProps {
  documentTitle: string;
  lessonTitle: string;
  documentId: string;
  isCompleted: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onMarkComplete: () => void;
}

export default function ReaderToolbar({
  documentTitle,
  lessonTitle,
  documentId,
  isCompleted,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onMarkComplete,
}: ReaderToolbarProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header
      className="shrink-0 h-14 flex items-center gap-3 px-4 border-b transition-colors"
      style={{
        backgroundColor: isDark ? '#1e293b' : '#FFFFFF',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      }}
    >
      {/* Back to Roadmap */}
      <button
        onClick={() => navigate(`/roadmap/${encodeURIComponent(documentId)}`)}
        className="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors shrink-0"
      >
        <ChevronLeft size={16} />
        Roadmap
      </button>

      {/* Breadcrumb */}
      <div className="hidden md:flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 min-w-0 flex-1">
        <span className="truncate max-w-[200px]">{documentTitle}</span>
        <ChevronRight size={14} className="shrink-0" />
        <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{lessonTitle}</span>
      </div>
      <div className="flex-1" />

      {/* Prev / Next */}
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous lesson"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next lesson"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Mark Complete */}
      <button
        onClick={onMarkComplete}
        disabled={isCompleted}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
          isCompleted
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        <CheckCircle size={15} />
        {isCompleted ? 'Completed' : 'Mark Complete'}
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Close (back to dashboard) */}
      <button
        onClick={() => navigate('/dashboard')}
        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Close reader"
      >
        <X size={16} />
      </button>
    </header>
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
git add frontend-src/src/features/reader/components/ReaderToolbar.tsx
git commit -m "feat: create ReaderToolbar with prev/next, mark complete, breadcrumb, theme toggle"
```

---

### Task 3: Create `PDFViewer`

**Files:**
- Create: `frontend-src/src/features/reader/components/PDFViewer.tsx`

- [ ] **Step 1: Create `frontend-src/src/features/reader/components/PDFViewer.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface PDFViewerProps {
  pdfUrl: string;
  initialPage?: number;
  /** ID of the container element — used to anchor the text selection listener */
  lessonTextId?: string;
}

export default function PDFViewer({ pdfUrl, initialPage = 1, lessonTextId = 'lessonText' }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isRendering, setIsRendering] = useState(false);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Load PDF
  useEffect(() => {
    pdfjsLib.getDocument(pdfUrl).promise.then((doc) => {
      setPdf(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(initialPage);
    }).catch(() => {
      // PDF failed to load — show fallback below
    });
  }, [pdfUrl, initialPage]);

  // Render page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }
    setIsRendering(true);
    pdf.getPage(currentPage).then((page) => {
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const task = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task;
      return task.promise;
    }).then(() => {
      setIsRendering(false);
    }).catch(() => {
      setIsRendering(false);
    });
  }, [pdf, currentPage, scale]);

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clamped);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-black/10 dark:border-white/10 bg-gray-50 dark:bg-[#0f172a]">
        <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
          className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors">
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="number"
            value={currentPage}
            min={1}
            max={totalPages}
            onChange={(e) => goToPage(Number(e.target.value))}
            className="w-12 text-center border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm py-0.5 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span>/ {totalPages}</span>
        </div>
        <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}
          className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors">
          <ChevronRight size={16} />
        </button>
        <div className="flex-1" />
        <button onClick={() => setScale((s) => Math.min(s + 0.2, 3))}
          className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <ZoomIn size={16} />
        </button>
        <span className="text-xs text-gray-400 dark:text-gray-500">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.max(s - 0.2, 0.5))}
          className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          <ZoomOut size={16} />
        </button>
      </div>

      {/* Canvas */}
      <div id={lessonTextId} className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-900 flex justify-center p-4">
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <canvas ref={canvasRef} className="shadow-lg max-w-full" />
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
git add frontend-src/src/features/reader/components/PDFViewer.tsx
git commit -m "feat: create PDFViewer with pdfjs-dist, page navigation, zoom controls"
```

---

### Task 4: Create `TextSelectionTooltip`

This component attaches a global `mouseup` listener and shows a floating popup when the user selects text inside the PDF viewer or lesson text area. Single-word selections also fetch a dictionary definition.

**Files:**
- Create: `frontend-src/src/features/reader/components/TextSelectionTooltip.tsx`

- [ ] **Step 1: Create `frontend-src/src/features/reader/components/TextSelectionTooltip.tsx`**

```tsx
import { useEffect, useState, useCallback } from 'react';
import { fetchDictionary } from '../services/readerService';

interface TooltipPosition {
  top: number;
  left: number;
}

interface DictionaryEntry {
  word: string;
  pos: string;
  def: string;
}

interface TextSelectionTooltipProps {
  /** ID of the scrollable container where selection is valid */
  containerId: string;
  onExplain: (text: string) => void;
  onFollowUp: (text: string) => void;
}

export default function TextSelectionTooltip({ containerId, onExplain, onFollowUp }: TextSelectionTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [dictEntry, setDictEntry] = useState<DictionaryEntry | null>(null);
  const [dictLoading, setDictLoading] = useState(false);

  const hide = useCallback(() => {
    setVisible(false);
    setDictEntry(null);
    setSelectedText('');
  }, []);

  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { hide(); return; }

      const text = sel.toString().trim();
      if (text.length < 2 || text.length > 300) { hide(); return; }

      // Only trigger inside the designated container
      const container = document.getElementById(containerId);
      if (!container) { hide(); return; }
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) { hide(); return; }

      setSelectedText(text);
      setVisible(true);
      setDictEntry(null);

      // Position the tooltip above the selection
      requestAnimationFrame(() => {
        const rect = range.getBoundingClientRect();
        const TW = 240;
        const TH = 100;
        const GUTTER = 8;
        let top = rect.top + window.scrollY - TH - GUTTER;
        let left = rect.left + window.scrollX + rect.width / 2 - TW / 2;
        left = Math.max(GUTTER, Math.min(left, window.innerWidth - TW - GUTTER));
        if (rect.top - TH - GUTTER < 0) top = rect.bottom + window.scrollY + GUTTER;
        setPosition({ top, left });
      });

      // For single words, fetch dictionary
      const isSingleWord = !/\s/.test(text) && text.length <= 30;
      if (isSingleWord) {
        setDictLoading(true);
        fetchDictionary(text).then((entry) => {
          setDictEntry(entry);
          setDictLoading(false);
        });
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [containerId, hide]);

  const handleExplain = () => {
    hide();
    window.getSelection()?.removeAllRanges();
    onExplain(selectedText);
  };

  const handleFollowUp = () => {
    hide();
    window.getSelection()?.removeAllRanges();
    onFollowUp(selectedText);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed z-[100] bg-white dark:bg-[#1e293b] rounded-xl shadow-xl border border-black/10 dark:border-white/10 p-3 w-60"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()} // prevent selection loss
    >
      {/* Dictionary entry for single words */}
      {(dictLoading || dictEntry) && (
        <div className="mb-2 pb-2 border-b border-black/10 dark:border-white/10">
          {dictLoading ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 animate-pulse">Looking up…</p>
          ) : dictEntry ? (
            <>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{dictEntry.word}</p>
              {dictEntry.pos && <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">{dictEntry.pos}</p>}
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{dictEntry.def}</p>
            </>
          ) : null}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleExplain}
          className="flex-1 py-1.5 px-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          💡 Explain
        </button>
        <button
          onClick={handleFollowUp}
          className="flex-1 py-1.5 px-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
        >
          💬 Follow-up
        </button>
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
git add frontend-src/src/features/reader/components/TextSelectionTooltip.tsx
git commit -m "feat: TextSelectionTooltip — floating popup on text select, dictionary lookup for single words"
```

---

### Task 5: Create `AIChatPanel`

**Files:**
- Create: `frontend-src/src/features/reader/components/AIChatPanel.tsx`

- [ ] **Step 1: Create `frontend-src/src/features/reader/components/AIChatPanel.tsx`**

```tsx
import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { sendChat } from '../services/readerService';
import type { ChatMessage } from '../services/readerService';

const STARTER_CHIPS = [
  'Explain this section in simple terms',
  'Give me a quiz on this lesson',
  'What are the key takeaways?',
];

const FOLLOWUP_CHIPS = [
  { label: '📖 Explain in detail', template: (p: string) => `Explain "${p}" in detail, covering its meaning, importance, and how it applies in this context.` },
  { label: '🔗 How does it connect?', template: (p: string) => `How does "${p}" connect to the broader topic? Explain the relationship.` },
  { label: '🌍 Real-world use', template: (p: string) => `Give a real-world example of how "${p}" is used outside of this lesson.` },
  { label: '🆚 Compare & contrast', template: (p: string) => `Compare "${p}" with a related concept in this lesson.` },
  { label: '❓ Why does it matter?', template: (p: string) => `Why is "${p}" important? What would change if it wasn't understood?` },
];

interface AIChatPanelProps {
  pdfId: string;
  lessonTitle: string;
  lessonContent: string;
  /** When set, auto-sends an explain message for the selected phrase */
  explainPhrase?: string | null;
  /** When set, sends a brief intro then shows follow-up chips */
  followUpPhrase?: string | null;
  onExplainHandled: () => void;
  onFollowUpHandled: () => void;
}

interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
  followUpPhrase?: string; // if set, show follow-up chips below this message
}

export default function AIChatPanel({
  pdfId,
  lessonTitle,
  lessonContent,
  explainPhrase,
  followUpPhrase,
  onExplainHandled,
  onFollowUpHandled,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<ChatMessage[]>([]);

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = async (text: string, followUpPhrase?: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: UiMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    historyRef.current = [...historyRef.current, { role: 'user', content: text }];

    const result = await sendChat(pdfId, lessonTitle, lessonContent, text, historyRef.current.slice(-10));
    const reply = result.reply ?? 'Sorry, I encountered an error. Please try again.';
    historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }];
    const assistantMsg: UiMessage = { role: 'assistant', content: reply, followUpPhrase };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsLoading(false);
  };

  // Handle explain phrase from text selection
  useEffect(() => {
    if (!explainPhrase) return;
    const q = `In the context of "${lessonTitle}", explain what "${explainPhrase}" means in simple, clear terms.`;
    sendMessage(q);
    onExplainHandled();
  }, [explainPhrase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle follow-up phrase from text selection
  useEffect(() => {
    if (!followUpPhrase) return;
    const q = `Briefly introduce "${followUpPhrase}" in the context of "${lessonTitle}" — just 1–2 sentences so the user can choose how to go deeper.`;
    sendMessage(q, followUpPhrase);
    onFollowUpHandled();
  }, [followUpPhrase]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3">
              Ask something about this lesson
            </p>
            {STARTER_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => sendMessage(chip)}
                disabled={isLoading}
                className="w-full text-left px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className="space-y-2">
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>

            {/* Follow-up chips — appear after AI response to a follow-up selection */}
            {msg.role === 'assistant' && msg.followUpPhrase && (
              <div className="space-y-1 pl-2">
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">
                  Go deeper with "{msg.followUpPhrase}"
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {FOLLOWUP_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => sendMessage(chip.template(msg.followUpPhrase!))}
                      disabled={isLoading}
                      className="text-xs px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-black/10 dark:border-white/10">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask about this lesson…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={16} />
          </button>
        </div>
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
git add frontend-src/src/features/reader/components/AIChatPanel.tsx
git commit -m "feat: AIChatPanel — starter chips, follow-up chips from text selection, typing indicator"
```

---

### Task 6: Create `QuizPanel`

**Files:**
- Create: `frontend-src/src/features/reader/components/QuizPanel.tsx`

- [ ] **Step 1: Create `frontend-src/src/features/reader/components/QuizPanel.tsx`**

```tsx
import { useState } from 'react';
import { generateQuiz, evaluateAnswer } from '../services/readerService';
import type { MicrotaskQuestion } from '../services/readerService';

const QUIZ_TYPES = [
  { id: 'multiple_choice', label: 'Multiple Choice', icon: '🔵' },
  { id: 'true_false', label: 'True / False', icon: '⚖️' },
  { id: 'identification', label: 'Identification', icon: '🔍' },
  { id: 'short_answer', label: 'Short Answer', icon: '✏️' },
  { id: 'essay', label: 'Essay', icon: '📝' },
];

interface QuizPanelProps {
  documentTitle: string;
  lessonTitle: string;
  lessonContent: string;
}

type PanelState = 'picker' | 'loading' | 'question' | 'result' | 'summary';

export default function QuizPanel({ documentTitle, lessonTitle, lessonContent }: QuizPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>('picker');
  const [quizType, setQuizType] = useState('multiple_choice');
  const [quizMode, setQuizMode] = useState<'quick' | 'custom'>('quick');
  const [quizCount, setQuizCount] = useState(3);
  const [questions, setQuestions] = useState<MicrotaskQuestion[]>([]);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; feedback: string; correctAnswer: string } | null>(null);
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [evaluating, setEvaluating] = useState(false);

  const currentQuestion = questions[questionIdx];

  const startQuiz = async () => {
    setPanelState('loading');
    setFeedback(null);
    setSelectedOption(null);
    setUserAnswer('');
    const count = quizMode === 'quick' ? 1 : quizCount;
    const result = await generateQuiz(lessonTitle, lessonContent, documentTitle, quizType, count, askedQuestions);
    if (result.success && result.tasks && result.tasks.length > 0) {
      // Dedup
      const seen = new Set(askedQuestions.map((q) => q.toLowerCase().trim()));
      const deduped = result.tasks.filter((t) => {
        const k = (t.question ?? '').toLowerCase().trim();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (deduped.length === 0) {
        setPanelState('summary');
        return;
      }
      setQuestions(deduped);
      setQuestionIdx(0);
      setAskedQuestions((prev) => [...prev, ...deduped.map((t) => t.question)]);
      setScore({ correct: 0, total: 0 });
      setPanelState('question');
    } else {
      setPanelState('picker');
    }
  };

  const submitAnswer = async () => {
    if (!currentQuestion) return;
    const answer =
      currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'true_false'
        ? selectedOption !== null
          ? currentQuestion.options[selectedOption]
          : ''
        : userAnswer.trim();
    if (!answer) return;

    setEvaluating(true);
    const result = await evaluateAnswer(
      currentQuestion.question,
      answer,
      currentQuestion.correctAnswer ?? currentQuestion.options?.[0] ?? '',
      currentQuestion.type
    );
    setEvaluating(false);
    setFeedback({
      isCorrect: result.isCorrect ?? false,
      feedback: result.feedback ?? '',
      correctAnswer: result.correctAnswer ?? '',
    });
    setScore((prev) => ({
      correct: prev.correct + (result.isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
    setPanelState('result');
  };

  const nextQuestion = () => {
    if (questionIdx + 1 < questions.length) {
      setQuestionIdx((i) => i + 1);
      setFeedback(null);
      setSelectedOption(null);
      setUserAnswer('');
      setPanelState('question');
    } else {
      if (quizMode === 'quick') {
        // Quick quiz: infinite — generate next question
        setPanelState('picker');
      } else {
        setPanelState('summary');
      }
    }
  };

  if (panelState === 'picker') {
    return (
      <div className="p-4 space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">📝 Set Up Your Quiz</h4>

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2 uppercase tracking-wide">Question Type</p>
          <div className="flex flex-wrap gap-1.5">
            {QUIZ_TYPES.map((t) => (
              <button key={t.id} onClick={() => setQuizType(t.id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${quizType === t.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-2 uppercase tracking-wide">Quiz Mode</p>
          <div className="flex gap-2">
            {(['quick', 'custom'] as const).map((mode) => (
              <button key={mode} onClick={() => setQuizMode(mode)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-colors ${quizMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                {mode === 'quick' ? '⚡ Quick (infinite)' : '🎯 Custom'}
              </button>
            ))}
          </div>
          {quizMode === 'custom' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Questions:</span>
              <input type="range" min={2} max={10} value={quizCount} onChange={(e) => setQuizCount(Number(e.target.value))}
                className="flex-1 accent-blue-600" />
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-4">{quizCount}</span>
            </div>
          )}
        </div>

        <button onClick={startQuiz}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors">
          {quizMode === 'quick' ? '⚡ Start Quick Quiz →' : `🎯 Start ${quizCount}-Question Quiz →`}
        </button>
      </div>
    );
  }

  if (panelState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400 dark:text-gray-500">Generating questions…</p>
      </div>
    );
  }

  if (panelState === 'summary') {
    const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
        <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{pct}%</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">{score.correct} / {score.total} correct</p>
        {pct >= 80 && <p className="text-sm font-medium text-green-600 dark:text-green-400">🎉 Great job!</p>}
        {pct < 50 && <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Keep practising! Try again below.</p>}
        <button onClick={() => { setAskedQuestions([]); setPanelState('picker'); setScore({ correct: 0, total: 0 }); }}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors">
          Try Again
        </button>
      </div>
    );
  }

  // Question view
  const isMC = currentQuestion?.type === 'multiple_choice' || currentQuestion?.type === 'true_false';
  const isTextAnswer = !isMC;
  const totalQ = questions.length;
  const pct = totalQ > 1 ? Math.round((questionIdx / totalQ) * 100) : 0;

  return (
    <div className="flex flex-col h-full p-4 gap-3 overflow-y-auto">
      {/* Progress bar */}
      {totalQ > 1 && (
        <div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Q {questionIdx + 1} / {totalQ}</p>
        </div>
      )}

      {/* Question */}
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-relaxed">
        {currentQuestion?.question}
      </p>

      {/* Options (MC / T-F) */}
      {isMC && panelState === 'question' && (
        <div className="space-y-2">
          {currentQuestion.options.map((opt, i) => (
            <button key={i} onClick={() => setSelectedOption(i)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${selectedOption === i ? 'bg-blue-600 text-white' : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>
              <span className="font-semibold mr-2">
                {currentQuestion.type === 'true_false' ? (i === 0 ? 'T' : 'F') : String.fromCharCode(65 + i)}.
              </span>
              {opt.replace(/^[A-DFT]\.\s*/, '')}
            </button>
          ))}
        </div>
      )}

      {/* Text answer */}
      {isTextAnswer && panelState === 'question' && (
        <textarea
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="Type your answer here…"
          rows={3}
          className="w-full resize-none rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      )}

      {/* Submit */}
      {panelState === 'question' && (
        <button onClick={submitAnswer} disabled={evaluating || (isMC ? selectedOption === null : !userAnswer.trim())}
          className="py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {evaluating ? 'Evaluating…' : 'Submit Answer'}
        </button>
      )}

      {/* Feedback */}
      {panelState === 'result' && feedback && (
        <div className={`rounded-xl p-3 text-sm ${feedback.isCorrect ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'}`}>
          <p className="font-semibold mb-1">{feedback.isCorrect ? '✅ Correct!' : '❌ Not quite'}</p>
          {feedback.feedback && <p className="text-xs">{feedback.feedback}</p>}
          {!feedback.isCorrect && feedback.correctAnswer && (
            <p className="text-xs mt-1">Correct answer: <span className="font-semibold">{feedback.correctAnswer}</span></p>
          )}
        </div>
      )}

      {/* Next */}
      {panelState === 'result' && (
        <button onClick={nextQuestion}
          className="py-2 bg-gray-800 dark:bg-gray-600 hover:bg-gray-900 dark:hover:bg-gray-500 text-white rounded-xl text-sm font-semibold transition-colors">
          {questionIdx + 1 < questions.length ? 'Next Question →' : quizMode === 'quick' ? 'Another Question →' : 'View Results'}
        </button>
      )}
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
git add frontend-src/src/features/reader/components/QuizPanel.tsx
git commit -m "feat: QuizPanel — quiz type picker, MC/T-F/text answers, AI evaluation, score summary"
```

---

### Task 7: Create `DeepDivePanel`

**Files:**
- Create: `frontend-src/src/features/reader/components/DeepDivePanel.tsx`

- [ ] **Step 1: Create `frontend-src/src/features/reader/components/DeepDivePanel.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { deepExplain } from '../services/readerService';
import type { DeepExplainResult } from '../services/readerService';

interface DeepDivePanelProps {
  pdfId: string;
  lessonId: string;
  lessonTitle: string;
  lessonContent: string;
  active: boolean; // only fetch when this tab is active
}

function SkeletonBlock() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-full" />
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-5/6" />
      <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded w-4/5" />
    </div>
  );
}

interface Section {
  label: string;
  emoji: string;
  key: keyof DeepExplainResult;
}

const SECTIONS: Section[] = [
  { label: 'Key Concepts', emoji: '🧠', key: 'keyConcepts' },
  { label: 'Examples', emoji: '💡', key: 'examples' },
  { label: 'Common Mistakes', emoji: '⚠️', key: 'commonMistakes' },
  { label: 'Further Reading', emoji: '📚', key: 'furtherReading' },
];

export default function DeepDivePanel({ pdfId, lessonId, lessonTitle, lessonContent, active }: DeepDivePanelProps) {
  const [data, setData] = useState<DeepExplainResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || data || isLoading) return;
    setIsLoading(true);
    setError(null);
    deepExplain(pdfId, lessonId, lessonTitle, lessonContent).then((result) => {
      if (result.success) {
        setData(result);
      } else {
        setError(result.error ?? 'Failed to load deep dive.');
      }
      setIsLoading(false);
    });
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full">
      {isLoading && SECTIONS.map((s) => (
        <div key={s.key}>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">{s.emoji} {s.label}</p>
          <SkeletonBlock />
        </div>
      ))}

      {error && (
        <div className="text-sm text-red-500 dark:text-red-400 text-center mt-8">
          <p className="mb-2">{error}</p>
          <button onClick={() => { setData(null); setIsLoading(false); }}
            className="text-xs text-primary hover:text-primary-dark font-medium transition-colors">
            Retry
          </button>
        </div>
      )}

      {data && SECTIONS.map((s) => {
        const content = data[s.key] as string | undefined;
        if (!content) return null;
        return (
          <div key={s.key}>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide mb-2">
              {s.emoji} {s.label}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
          </div>
        );
      })}
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
git add frontend-src/src/features/reader/components/DeepDivePanel.tsx
git commit -m "feat: DeepDivePanel — lazy fetch on tab activation, skeleton loaders, 4 sections"
```

---

### Task 8: Create `ReaderPage` — main layout shell

**Files:**
- Create: `frontend-src/src/features/reader/pages/ReaderPage.tsx`

- [ ] **Step 1: Create `frontend-src/src/features/reader/pages/ReaderPage.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { useDocuments } from '../../../shared/contexts/DocumentsContext';
import { loadProgress, saveProgress } from '../services/readerService';
import ReaderToolbar from '../components/ReaderToolbar';
import PDFViewer from '../components/PDFViewer';
import AIChatPanel from '../components/AIChatPanel';
import QuizPanel from '../components/QuizPanel';
import DeepDivePanel from '../components/DeepDivePanel';
import TextSelectionTooltip from '../components/TextSelectionTooltip';
import { useTheme } from '../../../shared/contexts/ThemeContext';

type RightTab = 'chat' | 'quiz' | 'deepdive' | 'notes';

export default function ReaderPage() {
  const { documentId = '', lessonId = '' } = useParams<{ documentId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { markLessonComplete } = useProgressContext();
  const { documents } = useDocuments();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<RightTab>('chat');
  const [isCompleted, setIsCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Text selection state (passed to chat)
  const [explainPhrase, setExplainPhrase] = useState<string | null>(null);
  const [followUpPhrase, setFollowUpPhrase] = useState<string | null>(null);

  // Look up the document and lesson from context
  const document = documents.find((d) => d.filename === documentId);
  const documentTitle = document?.title ?? documentId;

  // For now, lesson data comes from pdfService (we don't have a separate lesson store).
  // We use lessonId as both the display title and the backend ID.
  const lessonTitle = decodeURIComponent(lessonId);
  const lessonContent = ''; // filled by future lesson-detail API

  // Load completion status from backend
  useEffect(() => {
    if (!user?.id || !documentId) return;
    loadProgress(documentId, user.id).then((result) => {
      if (result.success && result.completedIds) {
        setIsCompleted(result.completedIds.map(String).includes(lessonId));
      }
    });
  }, [documentId, lessonId, user?.id]);

  const handleMarkComplete = async () => {
    if (isCompleted || !user?.id || !token) return;
    setIsCompleted(true);
    setShowConfetti(true);
    // Persist to ProgressContext (local)
    markLessonComplete(documentId, lessonId, document?.progress?.totalLessons ?? 0);
    // Persist to backend
    await saveProgress(documentId, user.id, lessonId, token);
    setTimeout(() => {
      setShowConfetti(false);
      navigate(`/roadmap/${encodeURIComponent(documentId)}`);
    }, 1500);
  };

  // Navigation between lessons (placeholder — lesson list not available here yet)
  const handlePrev = () => navigate(-1);
  const handleNext = () => navigate(1);

  const TABS: { id: RightTab; label: string }[] = [
    { id: 'chat', label: '💬 Chat' },
    { id: 'quiz', label: '📝 Quiz' },
    { id: 'deepdive', label: '🔍 Deep Dive' },
    { id: 'notes', label: '📌 Notes' },
  ];

  const bg = isDark ? '#0f172a' : '#F4F4F4';
  const card = isDark ? '#1e293b' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const textMuted = isDark ? '#94A3B8' : '#6B7280';

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: bg, fontFamily: 'Poppins, sans-serif' }}>
      {/* Toolbar */}
      <ReaderToolbar
        documentTitle={documentTitle}
        lessonTitle={lessonTitle}
        documentId={documentId}
        isCompleted={isCompleted}
        hasPrev={false}
        hasNext={false}
        onPrev={handlePrev}
        onNext={handleNext}
        onMarkComplete={handleMarkComplete}
      />

      {/* Text selection tooltip — global, anchored to lesson text container */}
      <TextSelectionTooltip
        containerId="lessonText"
        onExplain={(text) => { setExplainPhrase(text); setActiveTab('chat'); }}
        onFollowUp={(text) => { setFollowUpPhrase(text); setActiveTab('chat'); }}
      />

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Left: PDF Viewer (70%) */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <PDFViewer
            pdfUrl={`/api/pdf/file/${encodeURIComponent(documentId)}`}
            initialPage={1}
            lessonTextId="lessonText"
          />
        </div>

        {/* Right panel (30%) */}
        <div
          className="w-[360px] shrink-0 flex flex-col border-l"
          style={{ backgroundColor: card, borderColor: border }}
        >
          {/* Tab bar */}
          <div className="shrink-0 flex border-b" style={{ borderColor: border }}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 py-2.5 text-xs font-medium transition-colors"
                style={{
                  color: activeTab === tab.id ? '#3B82F6' : textMuted,
                  borderBottom: activeTab === tab.id ? '2px solid #3B82F6' : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === 'chat' && (
              <AIChatPanel
                pdfId={documentId}
                lessonTitle={lessonTitle}
                lessonContent={lessonContent}
                explainPhrase={explainPhrase}
                followUpPhrase={followUpPhrase}
                onExplainHandled={() => setExplainPhrase(null)}
                onFollowUpHandled={() => setFollowUpPhrase(null)}
              />
            )}
            {activeTab === 'quiz' && (
              <QuizPanel
                documentTitle={documentTitle}
                lessonTitle={lessonTitle}
                lessonContent={lessonContent}
              />
            )}
            {activeTab === 'deepdive' && (
              <DeepDivePanel
                pdfId={documentId}
                lessonId={lessonId}
                lessonTitle={lessonTitle}
                lessonContent={lessonContent}
                active={activeTab === 'deepdive'}
              />
            )}
            {activeTab === 'notes' && (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
                <p className="text-2xl">📌</p>
                <p className="text-sm font-medium" style={{ color: textMuted }}>Notes coming soon</p>
                <p className="text-xs text-center" style={{ color: textMuted }}>
                  Highlight and annotate key passages from this lesson.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confetti overlay on mark complete */}
      {showConfetti && (
        <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
          <div className="text-6xl animate-bounce">🎉</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Build**

```bash
cd .. && npm run build:frontend 2>&1 | tail -15
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/features/reader/
git commit -m "feat: full ReaderPage — PDF viewer, AI chat with follow-up chips, quiz panel, deep dive, text selection tooltip, progress persistence"
```

---

### Task 9: Wire lesson navigation from `RoadmapPage` to `ReaderPage`

**Files:**
- Modify: `frontend-src/src/features/roadmap/pages/RoadmapPage.tsx`

- [ ] **Step 1: Make lesson nodes clickable — navigate to `/reader/:documentId/:lessonId`**

In `RoadmapPage.tsx`, find where individual lesson items are rendered inside each module card (look for `lesson.id` or `lesson.title` in the JSX — typically in a list/map). For each unlocked lesson, wrap the click handler to navigate to the reader.

Add the import (if not already present):
```tsx
import { useNavigate } from 'react-router-dom';
```

Inside `RoadmapPage`, add:
```tsx
const navigate = useNavigate();
const documentId = useParams<{ documentId: string }>().documentId ?? '';
```

For each lesson item's click handler:
```tsx
const handleLessonClick = (lesson: { id: string; isCompleted: boolean; isCurrent: boolean }, module: { isLocked: boolean }) => {
  if (module.isLocked) return;
  navigate(`/reader/${encodeURIComponent(documentId)}/${encodeURIComponent(lesson.id)}`);
};
```

Find the lesson list render and update the `onClick` to use `handleLessonClick`. The exact location depends on the current JSX — search for where `lesson.title` is rendered and add `onClick={() => handleLessonClick(lesson, module)}` with `cursor-pointer` on the element.

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Build**

```bash
cd .. && npm run build:frontend 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/features/roadmap/pages/RoadmapPage.tsx
git commit -m "feat: RoadmapPage — lesson nodes navigate to /reader/:documentId/:lessonId"
```
