// src/features/reader/pages/ReaderPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { useAuth } from '../../../shared/contexts/AuthContext';
import * as pdfService from '../../../shared/services/pdfService';
import type { BackendLesson, LessonSet } from '../../../shared/services/pdfService';
import ReaderToolbar from '../components/ReaderToolbar';
import PDFViewer from '../components/PDFViewer';
import AIChatPanel from '../components/AIChatPanel';
import QuizPanel from '../components/QuizPanel';
import DeepDivePanel from '../components/DeepDivePanel';
import TextSelectionTooltip from '../components/TextSelectionTooltip';
import ConfettiOverlay from '../../roadmap/components/ConfettiOverlay';
import { cn } from '../../../shared/utils/cn';

type ActiveTab = 'chat' | 'notes';
type MainView = 'lesson' | 'pdf';

const NOTES_KEY = (docId: string, lesId: string) => `docvia-notes-${docId}-${lesId}`;

export default function ReaderPage() {
  const { documentId = '', lessonId = '' } = useParams<{
    documentId: string;
    lessonId: string;
  }>();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { token, user } = useAuth();
  const { markLessonComplete, lessonProgress } = useProgressContext();

  const isDark = theme === 'dark';

  // ── Lesson data ───────────────────────────────────────────────────────────
  const [lessonSet, setLessonSet] = useState<LessonSet | null>(null);
  const [lesson, setLesson] = useState<BackendLesson | null>(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [lessonLoadState, setLessonLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!documentId || !user?.id) return;
    setLessonLoadState('loading');

    pdfService.getLessons(documentId, user.id).then((result) => {
      if (result.success && result.data) {
        const set = result.data;
        setLessonSet(set);
        const idx = set.lessons.findIndex((l) => String(l.id) === lessonId);
        const resolvedIdx = idx >= 0 ? idx : 0;
        setLessonIndex(resolvedIdx);
        setLesson(set.lessons[resolvedIdx] ?? null);
        setLessonLoadState('ready');
      } else {
        setLessonLoadState('error');
      }
    }).catch(() => setLessonLoadState('error'));
  }, [documentId, lessonId, user?.id]);

  // ── Notes (auto-save via debounce) ────────────────────────────────────────
  const [notes, setNotes] = useState('');
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved notes when lesson changes
  useEffect(() => {
    if (!documentId || !lessonId) return;
    try {
      setNotes(localStorage.getItem(NOTES_KEY(documentId, lessonId)) ?? '');
    } catch {
      setNotes('');
    }
  }, [documentId, lessonId]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    // Debounce save — 500ms after last keystroke
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(NOTES_KEY(documentId, lessonId), value);
      } catch { /* quota errors ignored */ }
    }, 500);
  };

  // ── Panel / tab state ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [mainView, setMainView] = useState<MainView>('lesson');

  // ── Inline lesson section panels ─────────────────────────────────────────
  const [showQuiz, setShowQuiz] = useState(false);
  const [showDeepDive, setShowDeepDive] = useState(false);

  // ── Confetti ──────────────────────────────────────────────────────────────
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiOrigin, setConfettiOrigin] = useState({ x: 0, y: 0 });

  // ── Text selection → AI Chat injection ───────────────────────────────────
  const [injectMessage, setInjectMessage] = useState<string | null>(null);

  // ── Progress ──────────────────────────────────────────────────────────────
  const progressKey = `${documentId}:${lessonId}`;
  const isCompleted = lessonProgress[progressKey]?.isCompleted ?? false;
  const totalLessons = lessonSet?.totalLessons ?? 10;

  // ── Page title ────────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = lesson ? `${lesson.title} — Docvia` : 'Docvia Reader';
    return () => { document.title = 'Docvia'; };
  }, [lesson]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleBack = () => navigate(`/roadmap/${documentId}`);

  const goToLesson = (idx: number) => {
    if (!lessonSet) return;
    const target = lessonSet.lessons[idx];
    if (!target) return;
    navigate(`/reader/${documentId}/${target.id}`);
  };

  const handlePrevLesson = () => goToLesson(lessonIndex - 1);
  const handleNextLesson = () => goToLesson(lessonIndex + 1);

  const handleMarkComplete = () => {
    if (isCompleted) return;
    markLessonComplete(documentId, lessonId, totalLessons);
    setConfettiOrigin({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
    setShowConfetti(true);
    setTimeout(() => {
      setShowConfetti(false);
      navigate(`/roadmap/${documentId}`);
    }, 1500);
  };

  const handleGoDeeper = () => setShowDeepDive((v) => !v);

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'chat', label: 'AI Chat' },
    { key: 'notes', label: 'Notes' },
  ];

  const docTitle = lessonSet?.title ?? 'Document';
  const lessonTitle = lesson?.title ?? (lessonLoadState === 'loading' ? 'Loading…' : 'Lesson');

  return (
    <div
      className={cn('fixed inset-0 flex flex-col', 'bg-[#F4F4F4] dark:bg-[#0f172a]')}
      style={{ fontFamily: 'Poppins, sans-serif' }}
    >
      {/* Text-selection tooltip anchored to lesson content area */}
      <TextSelectionTooltip
        containerId="lessonContentArea"
        onExplain={(text) => {
          setInjectMessage(`Explain this: "${text}"`);
          setActiveTab('chat');
          setIsPanelOpen(true);
        }}
        onFollowUp={(text) => {
          setInjectMessage(`Tell me more about: "${text}"`);
          setActiveTab('chat');
          setIsPanelOpen(true);
        }}
      />

      {/* Toolbar */}
      <ReaderToolbar
        documentTitle={docTitle}
        lessonTitle={lessonTitle}
        onBack={handleBack}
        onPrevLesson={handlePrevLesson}
        onNextLesson={handleNextLesson}
        hasPrev={lessonIndex > 0}
        hasNext={lessonSet ? lessonIndex < lessonSet.lessons.length - 1 : false}
        onMarkComplete={handleMarkComplete}
        isCompleted={isCompleted}
        isPanelOpen={isPanelOpen}
        onTogglePanel={() => setIsPanelOpen((v) => !v)}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />

      {/* Content row */}
      <div className="pt-14 flex-1 flex overflow-hidden">

        {/* ── Main pane ── */}
        <div
          id="lessonContentArea"
          className={cn(
            'flex-1 flex flex-col overflow-hidden',
            isPanelOpen ? 'hidden md:flex' : 'flex',
          )}
        >
          {/* Lesson / PDF tab switcher */}
          <div
            className={cn(
              'shrink-0 flex gap-1 px-4 pt-3 pb-0',
              'border-b border-black/10 dark:border-white/10',
              'bg-white dark:bg-[#1e293b]',
            )}
          >
            {(['lesson', 'pdf'] as MainView[]).map((v) => (
              <button
                key={v}
                onClick={() => setMainView(v)}
                className={cn(
                  'px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors',
                  mainView === v
                    ? 'text-[#3B82F6] border-b-2 border-[#3B82F6] bg-transparent'
                    : 'text-[#6B7280] dark:text-[#94A3B8] hover:text-[#111827] dark:hover:text-[#F1F5F9]',
                )}
              >
                {v === 'lesson' ? '📖 Lesson' : '📄 PDF'}
              </button>
            ))}
          </div>

          {/* PDF view — fills full pane */}
          {mainView === 'pdf' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <PDFViewer
                documentId={documentId}
                initialPage={1}
                isDark={isDark}
                token={token ?? undefined}
              />
            </div>
          )}

          {/* Lesson view */}
          {mainView === 'lesson' && (
          <div className="flex-1 overflow-y-auto">
            {lessonLoadState === 'loading' && <LessonSkeleton isDark={isDark} />}
            {lessonLoadState === 'error' && <LessonError isDark={isDark} onBack={handleBack} />}
            {lessonLoadState === 'ready' && lesson && lessonSet && (
              <>
                <LessonContent
                  lesson={lesson}
                  lessonIndex={lessonIndex}
                  totalLessons={lessonSet.lessons.length}
                  isCompleted={isCompleted}
                  isDark={isDark}
                  deepDiveOpen={showDeepDive}
                  onGoDeeper={handleGoDeeper}
                />

                {/* Deep Dive — inline below lesson, above quiz */}
                {showDeepDive && (
                  <div className="px-6 md:px-12 pb-6">
                    <DeepDivePanel
                      lessonTitle={lesson.title}
                      lessonExplanation={lesson.explanation}
                      lessonKeyPoints={lesson.key_points ?? []}
                      documentTitle={docTitle}
                      isDark={isDark}
                      onClose={() => setShowDeepDive(false)}
                      token={token ?? undefined}
                    />
                  </div>
                )}

                {/* Quiz — inline below deep dive */}
                {showQuiz && (
                  <div className="px-6 md:px-12 pb-8">
                    <QuizPanel
                      documentTitle={docTitle}
                      lessonTitle={lesson.title}
                      lessonContent={lesson.explanation}
                      onClose={() => setShowQuiz(false)}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          )}

          {/* Bottom bar — only on lesson view */}
          {lessonLoadState === 'ready' && mainView === 'lesson' && (
            <div
              className={cn(
                'shrink-0 px-6 md:px-12 py-3 flex items-center justify-between',
                'bg-white dark:bg-[#1e293b]',
                'border-t border-black/10 dark:border-white/10',
                'shadow-[0_-4px_14px_rgba(0,0,0,0.05)]',
              )}
            >
              <div className="flex gap-3 items-center">
                <button
                  onClick={handleMarkComplete}
                  disabled={isCompleted}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
                    isCompleted
                      ? 'bg-gray-100 dark:bg-white/10 text-[#6B7280] dark:text-[#94A3B8] cursor-default'
                      : 'bg-gradient-to-r from-[#059669] to-[#10b981] text-white shadow-md hover:-translate-y-0.5',
                  )}
                >
                  {isCompleted ? '↩ Completed' : '✓ Mark as Complete'}
                </button>
                <button
                  onClick={() => setShowQuiz((v) => !v)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:-translate-y-0.5 text-white"
                  style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 3px 10px rgba(245,158,11,0.3)' }}
                >
                  📝 {showQuiz ? 'Close Quiz' : 'Take Quiz'}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePrevLesson}
                  disabled={lessonIndex === 0}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-black/10 dark:border-white/10 text-[#6B7280] dark:text-[#94A3B8] hover:border-[#3B82F6] hover:text-[#3B82F6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous
                </button>
                <button
                  onClick={handleNextLesson}
                  disabled={!lessonSet || lessonIndex >= lessonSet.lessons.length - 1}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border border-black/10 dark:border-white/10 text-[#6B7280] dark:text-[#94A3B8] hover:border-[#3B82F6] hover:text-[#3B82F6] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        {isPanelOpen && (
          <div
            className={cn(
              'w-full md:w-80 shrink-0 flex flex-col',
              'border-l border-black/10 dark:border-white/10',
              'bg-white dark:bg-[#1e293b]',
            )}
          >
            {/* Tab bar */}
            <div
              className={cn(
                'shrink-0 flex overflow-x-auto border-b border-black/10 dark:border-white/10',
                'bg-white dark:bg-[#1e293b]',
              )}
            >
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'shrink-0 px-3 py-3 text-xs font-semibold transition-colors whitespace-nowrap',
                    activeTab === tab.key
                      ? 'text-[#3B82F6] border-b-2 border-[#3B82F6]'
                      : 'text-[#6B7280] dark:text-[#94A3B8] hover:text-[#111827] dark:hover:text-[#F1F5F9]',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {activeTab === 'chat' && (
                <AIChatPanel
                  documentId={documentId}
                  lessonId={lessonId}
                  isDark={isDark}
                  injectMessage={injectMessage}
                  onInjectHandled={() => setInjectMessage(null)}
                />
              )}
              {activeTab === 'notes' && (
                <NotesTab
                  isDark={isDark}
                  value={notes}
                  onChange={handleNotesChange}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confetti */}
      <div className="fixed inset-0 pointer-events-none z-50">
        <ConfettiOverlay active={showConfetti} origin={confettiOrigin} />
      </div>
    </div>
  );
}

// ─── Lesson content ───────────────────────────────────────────────────────────
interface LessonContentProps {
  lesson: BackendLesson;
  lessonIndex: number;
  totalLessons: number;
  isCompleted: boolean;
  isDark: boolean;
  deepDiveOpen: boolean;
  onGoDeeper: () => void;
}

function LessonContent({
  lesson, lessonIndex, totalLessons, isCompleted, isDark, deepDiveOpen, onGoDeeper,
}: LessonContentProps) {
  // Split explanation into paragraphs for readable rendering
  const paragraphs = lesson.explanation
    ? lesson.explanation
        .replace(/\s{3,}/g, '  ')
        .split(/\n{2,}/)
        .map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
        .filter((p) => p.length > 0)
    : [];

  return (
    <div className="px-6 md:px-12 py-9 w-full">
      {/* Hero header */}
      <div className="mb-7 pb-6 border-b border-black/10 dark:border-white/10">
        {/* Lesson number badge */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold mb-3"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', boxShadow: '0 3px 10px rgba(59,130,246,0.4)' }}
        >
          {lessonIndex + 1}
        </div>
        <h1
          className="text-2xl font-bold leading-snug mb-2.5"
          style={{ color: isDark ? '#F1F5F9' : '#111827' }}
        >
          {lesson.title}
        </h1>
        <div className="flex flex-wrap gap-2 mt-2">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF', color: '#3B82F6' }}
          >
            📖 Lesson {lessonIndex + 1} of {totalLessons}
          </span>
          {isCompleted && (
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: isDark ? 'rgba(34,197,94,0.15)' : '#F0FDF4', color: '#16A34A' }}
            >
              ✓ Completed
            </span>
          )}
        </div>
      </div>

      {/* Key Takeaways */}
      {lesson.key_points && lesson.key_points.length > 0 && (
        <div
          className="rounded-xl p-5 mb-7"
          style={{ background: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF' }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: '#3B82F6' }}
          >
            Key Takeaways
          </p>
          <ul className="space-y-2">
            {lesson.key_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: isDark ? '#94A3B8' : '#374151' }}>
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: '#3B82F6' }}
                />
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lesson content label */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: isDark ? '#94A3B8' : '#9CA3AF' }}>
          Lesson Content
        </span>
        <div className="flex-1 h-px" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }} />
      </div>

      {/* Explanation paragraphs */}
      <div className="space-y-4 mb-8" style={{ color: isDark ? '#CBD5E1' : '#1F2937', fontSize: '16px', lineHeight: '1.85' }}>
        {paragraphs.length > 0
          ? paragraphs.map((p, i) => <p key={i}>{p}</p>)
          : (
            <p className="italic" style={{ color: isDark ? '#475569' : '#9CA3AF' }}>
              No content available for this lesson.
            </p>
          )}
      </div>

      {/* Go Deeper teaser */}
      <div className="flex items-center gap-4 mt-2">
        <div className="flex-1 h-px" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }} />
        <button
          onClick={onGoDeeper}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5"
          style={{
            background: isDark ? 'rgba(139,92,246,0.15)' : '#F5F3FF',
            color: '#7C3AED',
            border: `1.5px dashed ${deepDiveOpen ? '#7c3aed' : '#c4b5fd'}`,
          }}
        >
          🔬 Go Deeper on this Lesson
          <span
            className="text-xs transition-transform duration-200"
            style={{ display: 'inline-block', transform: deepDiveOpen ? 'rotate(180deg)' : 'none' }}
          >▾</span>
        </button>
        <div className="flex-1 h-px" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }} />
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LessonSkeleton({ isDark }: { isDark: boolean }) {
  const base = isDark ? 'bg-white/10' : 'bg-gray-200';
  return (
    <div className="px-6 md:px-12 py-9 max-w-3xl animate-pulse">
      <div className={cn('w-9 h-9 rounded-full mb-4', base)} />
      <div className={cn('h-7 rounded w-2/3 mb-3', base)} />
      <div className={cn('h-4 rounded w-1/4 mb-8', base)} />
      <div className={cn('h-24 rounded-xl mb-7', base)} />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className={cn('h-4 rounded', base, i === 4 ? 'w-1/2' : 'w-full')} />)}
      </div>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function LessonError({ isDark, onBack }: { isDark: boolean; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="text-4xl mb-4">📚</div>
      <p className="font-semibold text-base mb-1" style={{ color: isDark ? '#F1F5F9' : '#111827' }}>
        Could not load lesson
      </p>
      <p className="text-sm mb-4" style={{ color: isDark ? '#94A3B8' : '#6B7280' }}>
        The lesson content couldn't be fetched. Try going back and reopening.
      </p>
      <button
        onClick={onBack}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
        style={{ background: '#3B82F6' }}
      >
        ← Back to Roadmap
      </button>
    </div>
  );
}

// ─── Notes tab (auto-save) ────────────────────────────────────────────────────
interface NotesTabProps {
  isDark: boolean;
  value: string;
  onChange: (v: string) => void;
}

function NotesTab({ isDark, value, onChange }: NotesTabProps) {
  return (
    <div className="flex-1 flex flex-col p-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Take notes here…"
        className={cn(
          'flex-1 w-full resize-none rounded-xl p-3 text-sm leading-relaxed outline-none',
          'bg-gray-50 dark:bg-[#0f172a]',
          'border border-black/10 dark:border-white/10',
          'text-[#111827] dark:text-[#F1F5F9]',
          'placeholder:text-[#6B7280] dark:placeholder:text-[#94A3B8]',
          'focus:ring-1 focus:ring-[#3B82F6]',
        )}
        style={{ fontFamily: 'Poppins, sans-serif' }}
        aria-label="Lesson notes"
      />
      <p className={cn('mt-2 text-xs', isDark ? 'text-[#94A3B8]' : 'text-[#6B7280]')}>
        Notes are saved automatically.
      </p>
    </div>
  );
}
