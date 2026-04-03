// src/features/reader/pages/ReaderPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import ReaderToolbar from '../components/ReaderToolbar';
import PDFViewer from '../components/PDFViewer';
import AIChatPanel from '../components/AIChatPanel';
import QuizPanel from '../components/QuizPanel';
import DeepDivePanel from '../components/DeepDivePanel';
import TextSelectionTooltip from '../components/TextSelectionTooltip';
import ConfettiOverlay from '../../roadmap/components/ConfettiOverlay';
import { cn } from '../../../shared/utils/cn';

type ActiveTab = 'chat' | 'quiz' | 'deepdive' | 'notes';

const MOCK_LESSON_TITLE = 'Loading lesson…';
const MOCK_DOC_TITLE = 'Document';
const TOTAL_LESSONS_MOCK = 10;

export default function ReaderPage() {
  const { documentId = '', lessonId = '' } = useParams<{
    documentId: string;
    lessonId: string;
  }>();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { markLessonComplete, lessonProgress } = useProgressContext();

  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [confettiOrigin, setConfettiOrigin] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [injectMessage, setInjectMessage] = useState<string | null>(null);

  // Derived: is this lesson already completed?
  const progressKey = `${documentId}:${lessonId}`;
  const isCompleted = lessonProgress[progressKey]?.isCompleted ?? false;

  // On mount: set page title
  useEffect(() => {
    document.title = `${MOCK_DOC_TITLE} — Docvia Reader`;
    return () => {
      document.title = 'Docvia';
    };
  }, []);

  const handleBack = () => {
    navigate(`/roadmap/${documentId}`);
  };

  const handlePrevLesson = () => {
    // Placeholder — wire to real lesson list when backend ready
  };

  const handleNextLesson = () => {
    // Placeholder — wire to real lesson list when backend ready
  };

  const handleMarkComplete = () => {
    if (isCompleted) return;

    markLessonComplete(documentId, lessonId, TOTAL_LESSONS_MOCK);

    setConfettiOrigin({
      x: window.innerWidth / 2,
      y: window.innerHeight / 3,
    });
    setShowConfetti(true);

    setTimeout(() => {
      setShowConfetti(false);
      navigate(`/roadmap/${documentId}`);
    }, 1500);
  };

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: 'chat', label: 'AI Chat' },
    { key: 'quiz', label: 'Quiz' },
    { key: 'deepdive', label: 'Deep Dive' },
    { key: 'notes', label: 'Notes' },
  ];

  return (
    <div
      className={cn(
        'fixed inset-0 flex flex-col',
        'bg-[#F4F4F4] dark:bg-[#0f172a]',
      )}
      style={{ fontFamily: 'Poppins, sans-serif' }}
    >
      {/* Text selection tooltip — anchored to PDF viewer container */}
      <TextSelectionTooltip
        containerId="pdfViewerContainer"
        onExplain={(text) => {
          setInjectMessage(`Explain this: "${text}"`);
          setActiveTab('chat');
        }}
        onFollowUp={(text) => {
          setInjectMessage(`Can you tell me more about: "${text}"?`);
          setActiveTab('chat');
        }}
      />

      {/* Fixed toolbar */}
      <ReaderToolbar
        documentTitle={MOCK_DOC_TITLE}
        lessonTitle={MOCK_LESSON_TITLE}
        onBack={handleBack}
        onPrevLesson={handlePrevLesson}
        onNextLesson={handleNextLesson}
        hasPrev={false}
        hasNext={false}
        onMarkComplete={handleMarkComplete}
        isCompleted={isCompleted}
        isPanelOpen={isPanelOpen}
        onTogglePanel={() => setIsPanelOpen((v) => !v)}
        isDark={isDark}
        toggleTheme={toggleTheme}
      />

      {/* Content area (below toolbar) */}
      <div className="pt-14 flex-1 flex overflow-hidden">
        {/* PDF Viewer */}
        <div
          id="pdfViewerContainer"
          className={cn(
            'flex-1 overflow-hidden',
            isPanelOpen ? 'hidden md:flex md:flex-col' : 'flex flex-col',
          )}
        >
          <PDFViewer
            documentId={documentId}
            initialPage={1}
            isDark={isDark}
          />
        </div>

        {/* Right panel */}
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
                'shrink-0 flex border-b border-black/10 dark:border-white/10',
                'bg-white dark:bg-[#1e293b]',
              )}
            >
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex-1 py-3 text-sm font-medium transition-colors',
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
              {activeTab === 'quiz' && (
                <QuizPanel
                  documentTitle={MOCK_DOC_TITLE}
                  lessonTitle={MOCK_LESSON_TITLE}
                  lessonContent=""
                />
              )}
              {activeTab === 'deepdive' && (
                <DeepDivePanel
                  lessonId={lessonId}
                  isDark={isDark}
                />
              )}
              {activeTab === 'notes' && (
                <NotesTab isDark={isDark} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Confetti overlay */}
      <div className="fixed inset-0 pointer-events-none z-50">
        <ConfettiOverlay
          active={showConfetti}
          origin={confettiOrigin}
        />
      </div>
    </div>
  );
}

// ----- Notes tab (simple, no persistence needed) -----
interface NotesTabProps {
  isDark: boolean;
}

function NotesTab({ isDark }: NotesTabProps) {
  return (
    <div className="flex-1 flex flex-col p-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <textarea
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
      <p className={cn(
        'mt-2 text-xs',
        isDark ? 'text-[#94A3B8]' : 'text-[#6B7280]',
      )}>
        Notes are not saved between sessions.
      </p>
    </div>
  );
}
