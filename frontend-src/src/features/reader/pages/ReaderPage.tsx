// src/features/reader/pages/ReaderPage.tsx
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { useProgressContext } from "../../../shared/contexts/ProgressContext";
import { useAuth } from "../../../shared/contexts/AuthContext";
import * as pdfService from "../../../shared/services/pdfService";
import type {
  BackendLesson,
  LessonSet,
} from "../../../shared/services/pdfService";
import ReaderToolbar from "../components/ReaderToolbar";
import PDFViewer from "../components/PDFViewer";
import AIChatPanel from "../components/AIChatPanel";
import QuizPanel from "../components/QuizPanel";
import DeepDivePanel from "../components/DeepDivePanel";
import TextSelectionTooltip from "../components/TextSelectionTooltip";
import ConfettiOverlay from "../../roadmap/components/ConfettiOverlay";
import { cn } from "../../../shared/utils/cn";

type ActiveTab = "chat" | "notes";
type MainView = "lesson" | "pdf";

const NOTES_KEY = (docId: string, lesId: string) =>
  `docvia-notes-${docId}-${lesId}`;
const NOTES_TS_KEY = (docId: string, lesId: string) =>
  `docvia-notes-ts-${docId}-${lesId}`;

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ReaderPage() {
  const { documentId = "", lessonId = "" } = useParams<{
    documentId: string;
    lessonId: string;
  }>();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { token, user } = useAuth();
  const { markLessonComplete, setCurrentLesson, lessonProgress } =
    useProgressContext();

  const isDark = theme === "dark";

  // ── Lesson data ───────────────────────────────────────────────────────────
  const [lessonSet, setLessonSet] = useState<LessonSet | null>(null);
  const [lesson, setLesson] = useState<BackendLesson | null>(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [lessonLoadState, setLessonLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");

  useEffect(() => {
    if (!documentId || !user?.id) return;
    setLessonLoadState("loading");

    const resolveLessonSet = async () => {
      const cached = await pdfService.getLessons(
        documentId,
        user.id,
        token ?? undefined,
      );
      if (cached.success && cached.data) return cached.data;

      const generated = await pdfService.generateLessons(
        documentId,
        user.id,
        token ?? undefined,
      );
      if (generated.success && generated.data) return generated.data;

      return null;
    };

    resolveLessonSet()
      .then((set) => {
        if (!set) {
          setLessonLoadState("error");
          return;
        }
        setLessonSet(set);
        const idx = set.lessons.findIndex((l) => String(l.id) === lessonId);
        const resolvedIdx = idx >= 0 ? idx : 0;
        setLessonIndex(resolvedIdx);
        setLesson(set.lessons[resolvedIdx] ?? null);
        setLessonLoadState("ready");
      })
      .catch(() => setLessonLoadState("error"));
  }, [documentId, lessonId, user?.id, token]);

  // ── Notes (auto-save with timestamp) ─────────────────────────────────────
  const [notes, setNotes] = useState("");
  const [notesLastChanged, setNotesLastChanged] = useState<string | null>(null);
  const [notesTimestamp, setNotesTimestamp] = useState<string>("");
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!documentId || !lessonId) return;
    try {
      setNotes(localStorage.getItem(NOTES_KEY(documentId, lessonId)) ?? "");
      const ts = localStorage.getItem(NOTES_TS_KEY(documentId, lessonId));
      setNotesLastChanged(ts);
      if (ts) setNotesTimestamp(formatTimestamp(ts));
    } catch {
      setNotes("");
    }
  }, [documentId, lessonId]);

  // Update timestamp display every minute
  useEffect(() => {
    if (!notesLastChanged) return;
    const interval = setInterval(() => {
      setNotesTimestamp(formatTimestamp(notesLastChanged));
    }, 60000);
    return () => clearInterval(interval);
  }, [notesLastChanged]);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => {
      try {
        const now = new Date().toISOString();
        localStorage.setItem(NOTES_KEY(documentId, lessonId), value);
        localStorage.setItem(NOTES_TS_KEY(documentId, lessonId), now);
        setNotesLastChanged(now);
        setNotesTimestamp(formatTimestamp(now));
      } catch {
        /* quota errors ignored */
      }
    }, 500);
  };

  // ── Panel / tab state ─────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [mainView, setMainView] = useState<MainView>("lesson");

  // ── Inline lesson section panels ─────────────────────────────────────────
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizInProgress, setQuizInProgress] = useState(false);
  const [quizRestartSignal, setQuizRestartSignal] = useState(0);
  const [showDeepDive, setShowDeepDive] = useState(false);
  const goDeeperButtonRef = useRef<HTMLButtonElement | null>(null);
  const takeQuizButtonRef = useRef<HTMLButtonElement | null>(null);

  // ── Confetti ──────────────────────────────────────────────────────────────
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiOrigin, setConfettiOrigin] = useState({ x: 0, y: 0 });

  // ── Text selection → AI Chat injection ───────────────────────────────────
  const [injectMessage, setInjectMessage] = useState<string | null>(null);

  // ── Progress ──────────────────────────────────────────────────────────────
  const progressKey = `${documentId}:${lessonId}`;
  const isCompleted = lessonProgress[progressKey]?.isCompleted ?? false;
  const totalLessons =
    lessonSet && lessonSet.lessons.length > 0
      ? lessonSet.totalLessons || lessonSet.lessons.length
      : 0;

  // Track open lesson + total count for Progress page (no fake default like 10)
  useEffect(() => {
    if (!documentId || !lessonId || lessonLoadState !== "ready" || !lessonSet)
      return;
    const tl = lessonSet.totalLessons || lessonSet.lessons.length;
    if (tl < 1) return;
    setCurrentLesson(documentId, lessonId, tl);
  }, [documentId, lessonId, lessonLoadState, lessonSet, setCurrentLesson]);

  // ── Page title ────────────────────────────────────────────────────────────
  useEffect(() => {
    document.title = lesson ? `${lesson.title} — Docvia` : "Docvia Reader";
    return () => {
      document.title = "Docvia";
    };
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
    if (isCompleted || totalLessons < 1) return;
    markLessonComplete(documentId, lessonId, totalLessons);
    setConfettiOrigin({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
    setShowConfetti(true);
    setTimeout(() => {
      setShowConfetti(false);
      navigate(`/roadmap/${documentId}`);
    }, 1500);
  };

  const handleGoDeeper = () => setShowDeepDive((v) => !v);

  useEffect(() => {
    if (!showDeepDive) return;
    requestAnimationFrame(() => {
      goDeeperButtonRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [showDeepDive]);

  useEffect(() => {
    if (!showQuiz) return;
    requestAnimationFrame(() => {
      takeQuizButtonRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [showQuiz]);

  const TABS: { key: ActiveTab; label: string }[] = [
    { key: "chat", label: "AI Chat" },
    { key: "notes", label: "Notes" },
  ];

  const docTitle = lessonSet?.title ?? "Document";
  const lessonTitle =
    lesson?.title ?? (lessonLoadState === "loading" ? "Loading…" : "Lesson");

  return (
    <div
      className={cn(
        "fixed inset-0 flex flex-col",
        isDark ? "bg-[#0f172a]" : "bg-[#F4F4F8]",
      )}
      style={{ fontFamily: "Poppins, sans-serif" }}
    >
      <TextSelectionTooltip
        containerId="lessonContentArea"
        onExplain={(text) => {
          setInjectMessage(`Explain this: "${text}"`);
          setActiveTab("chat");
          setIsPanelOpen(true);
        }}
        onFollowUp={(text) => {
          setInjectMessage(`Tell me more about: "${text}"`);
          setActiveTab("chat");
          setIsPanelOpen(true);
        }}
      />

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
        // FIX: Use the actual logic for these values
        completedCount={
          Object.values(lessonProgress).filter(
            (p) => p.documentId === documentId && p.isCompleted,
          ).length
        }
        totalLessons={totalLessons}
      />

      {/* Content row */}
      <div className="pt-14 flex-1 flex min-h-0 overflow-hidden">
        {/* ── Main pane ──
            When the side panel is open on small screens, we hide this column only for the
            Lesson view so chat/notes can use the full width. PDF must stay visible — otherwise
            "PDF" tab looks blank (segment reader + PDF). */}
        <div
          id="lessonContentArea"
          className={cn(
            "flex-1 flex flex-col min-h-0 overflow-hidden",
            isPanelOpen && mainView === "lesson" ? "hidden md:flex" : "flex",
          )}
        >
          {/* Lesson / PDF tab switcher */}
          <div
            className={cn(
              "shrink-0 flex gap-1 px-4 pt-3 pb-0 border-b",
              isDark
                ? "bg-[#1e293b] border-white/10"
                : "bg-white border-black/10",
            )}
          >
            {(["lesson", "pdf"] as MainView[]).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setMainView(v);
                  // Give PDF the full width on phones (panel would otherwise squeeze or cover).
                  if (
                    v === "pdf" &&
                    typeof window !== "undefined" &&
                    window.matchMedia("(max-width: 767px)").matches
                  ) {
                    setIsPanelOpen(false);
                  }
                }}
                className={cn(
                  "px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors",
                  mainView === v
                    ? "text-[#3B82F6] border-b-2 border-[#3B82F6] bg-transparent"
                    : isDark
                      ? "text-[#94A3B8] hover:text-[#F1F5F9]"
                      : "text-[#6B7280] hover:text-[#111827]",
                )}
              >
                {v === "lesson" ? "📖 Lesson" : "📄 PDF"}
              </button>
            ))}
          </div>

          {/* PDF view — fills full pane (min-h-0 so nested scroll works) */}
          {mainView === "pdf" && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <PDFViewer
                documentId={documentId}
                initialPage={1}
                isDark={isDark}
                token={token ?? undefined}
              />
            </div>
          )}

          {/* Lesson view */}
          {mainView === "lesson" && (
            <div className="flex-1 overflow-y-auto">
              {lessonLoadState === "loading" && (
                <LessonSkeleton isDark={isDark} />
              )}
              {lessonLoadState === "error" && (
                <LessonError isDark={isDark} onBack={handleBack} />
              )}
              {lessonLoadState === "ready" && lesson && lessonSet && (
                <>
                  <LessonContent
                    lesson={lesson}
                    lessonIndex={lessonIndex}
                    totalLessons={lessonSet.lessons.length}
                    isCompleted={isCompleted}
                    isDark={isDark}
                    deepDiveOpen={showDeepDive}
                    onGoDeeper={handleGoDeeper}
                    goDeeperButtonRef={goDeeperButtonRef}
                    keyPoints={lesson.key_points ?? []}
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
                </>
              )}
            </div>
          )}

          {/* Bottom bar */}
          {lessonLoadState === "ready" && mainView === "lesson" && (
            <div
              className={cn(
                "shrink-0 px-6 md:px-12 py-3 flex items-center justify-between",
                isDark
                  ? "bg-[#1e293b] border-white/10"
                  : "bg-white border-black/10",
                "border-t shadow-[0_-4px_14px_rgba(0,0,0,0.05)]",
              )}
            >
              <div className="flex gap-3 items-center">
                <button
                  onClick={handleMarkComplete}
                  disabled={isCompleted}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all",
                    isCompleted
                      ? isDark
                        ? "bg-white/10 text-[#94A3B8] cursor-default"
                        : "bg-gray-100 text-[#6B7280] cursor-default"
                      : "bg-linear-to-r from-[#059669] to-[#10b981] text-white shadow-md hover:-translate-y-0.5",
                  )}
                >
                  {isCompleted ? "↩ Mark as Incomplete" : "✓ Mark as Complete"}
                </button>
                <button
                  onClick={() => setShowQuiz(true)}
                  ref={takeQuizButtonRef}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:-translate-y-0.5 text-white"
                  style={{
                    background: "linear-gradient(135deg,#f59e0b,#d97706)",
                    boxShadow: "0 3px 10px rgba(245,158,11,0.3)",
                  }}
                >
                  📝 {quizInProgress ? "Continue Quiz" : "Take Quiz"}
                </button>
                {quizInProgress && (
                  <button
                    onClick={() => {
                      setQuizRestartSignal((v) => v + 1);
                      setShowQuiz(true);
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-[#f59e0b]/40 text-[#b45309] dark:text-[#fbbf24] hover:bg-[#f59e0b]/10 transition-colors"
                    title="Start a fresh quiz session"
                  >
                    Start New
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePrevLesson}
                  disabled={lessonIndex === 0}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-semibold border transition-colors",
                    isDark
                      ? "border-white/10 text-[#94A3B8] hover:border-[#3B82F6] hover:text-[#3B82F6] disabled:opacity-30 disabled:cursor-not-allowed"
                      : "border-black/10 text-[#6B7280] hover:border-[#3B82F6] hover:text-[#3B82F6] disabled:opacity-30 disabled:cursor-not-allowed",
                  )}
                >
                  ← Previous
                </button>
                <button
                  onClick={handleNextLesson}
                  disabled={
                    !lessonSet || lessonIndex >= lessonSet.lessons.length - 1
                  }
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-semibold border transition-colors",
                    isDark
                      ? "border-white/10 text-[#94A3B8] hover:border-[#3B82F6] hover:text-[#3B82F6] disabled:opacity-30 disabled:cursor-not-allowed"
                      : "border-black/10 text-[#6B7280] hover:border-[#3B82F6] hover:text-[#3B82F6] disabled:opacity-30 disabled:cursor-not-allowed",
                  )}
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        {isPanelOpen && (
          <div
            className={cn(
              "w-full md:w-80 shrink-0 flex flex-col",
              "border-l",
              isDark
                ? "bg-[#1e293b] border-white/10"
                : "bg-white border-black/10",
            )}
          >
            {/* Tab bar */}
            <div
              className={cn(
                "shrink-0 flex overflow-x-auto border-b",
                isDark
                  ? "bg-[#1e293b] border-white/10"
                  : "bg-white border-black/10",
              )}
            >
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "shrink-0 px-4 py-3 text-xs font-semibold transition-colors whitespace-nowrap",
                    activeTab === tab.key
                      ? "text-[#3B82F6] border-b-2 border-[#3B82F6]"
                      : isDark
                        ? "text-[#94A3B8] hover:text-[#F1F5F9]"
                        : "text-[#6B7280] hover:text-[#111827]",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Panel header info */}
            {activeTab === "chat" && (
              <div
                className={cn(
                  "shrink-0 px-4 py-3 border-b",
                  isDark
                    ? "bg-[#1e293b] border-white/10"
                    : "bg-[#F8FAFC] border-black/6",
                )}
              >
                <p
                  className={cn(
                    "text-xs font-semibold",
                    isDark ? "text-[#F1F5F9]" : "text-[#111827]",
                  )}
                >
                  AI Tutor
                </p>
                <p
                  className={cn(
                    "text-[10px] mt-0.5",
                    isDark ? "text-[#94A3B8]" : "text-[#6B7280]",
                  )}
                >
                  Ask anything about this lesson
                </p>
              </div>
            )}

            <div className="flex-1 overflow-hidden flex flex-col">
              {activeTab === "chat" && (
                <AIChatPanel
                  documentId={documentId}
                  lessonId={lessonId}
                  lessonTitle={lesson?.title ?? ""}
                  lessonContent={lesson?.explanation ?? ""}
                  isDark={isDark}
                  token={token ?? undefined}
                  injectMessage={injectMessage}
                  onInjectHandled={() => setInjectMessage(null)}
                />
              )}
              {activeTab === "notes" && (
                <NotesTab
                  isDark={isDark}
                  value={notes}
                  onChange={handleNotesChange}
                  lastChanged={notesTimestamp}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quiz modal (state persists when closed) */}
      {mainView === "lesson" && lessonLoadState === "ready" && lesson && (
        <div
          className={cn(
            "fixed inset-0 z-[70] flex items-center justify-center p-4",
            showQuiz
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0",
          )}
          style={{
            background: showQuiz ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0)",
            transition: "opacity 180ms ease",
          }}
          onClick={() => setShowQuiz(false)}
        >
          <div
            className={cn(
              "w-full max-w-3xl max-h-[82vh] overflow-hidden rounded-2xl border shadow-2xl",
              "bg-white dark:bg-[#1e293b] border-black/10 dark:border-white/10",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <QuizPanel
              documentTitle={docTitle}
              lessonTitle={lesson.title}
              lessonContent={lesson.explanation}
              isDark={isDark}
              token={token ?? undefined}
              restartSignal={quizRestartSignal}
              onSessionChange={setQuizInProgress}
              onClose={() => setShowQuiz(false)}
            />
          </div>
        </div>
      )}

      {/* Confetti */}
      <div className="fixed inset-0 pointer-events-none z-50">
        <ConfettiOverlay active={showConfetti} origin={confettiOrigin} />
      </div>
    </div>
  );
}

// ─── Three-row lesson body (segment-grounded) ────────────────────────────────
interface LessonRow {
  label: string;
  subtitle: string;
  body: string;
}

function buildLessonRows(
  explanation: string,
  keyPoints: string[],
): LessonRow[] {
  const rows: LessonRow[] = [
    {
      label: "Core idea & textual detail",
      subtitle: "Precise claim plus concrete facts from the passage",
      body: "",
    },
    {
      label: "Evidence & reasoning",
      subtitle: "How the document argues or illustrates this idea",
      body: "",
    },
    {
      label: "Implications & contrasts",
      subtitle: "What follows, what it pushes against, or what stays open",
      body: "",
    },
  ];

  const raw = explanation?.trim() ?? "";
  if (!raw) {
    return rows.map((r) => ({
      ...r,
      body: "Content for this segment will appear once the lesson is fully generated.",
    }));
  }

  const paragraphs = raw
    .replace(/\s{3,}/g, "  ")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length >= 3) {
    rows[0].body = paragraphs[0];
    rows[1].body = paragraphs[1];
    rows[2].body = paragraphs.slice(2).join("\n\n");
  } else if (paragraphs.length === 2) {
    rows[0].body = paragraphs[0];
    rows[1].body = paragraphs[1];
    rows[2].body =
      keyPoints.length > 0
        ? keyPoints.map((k) => `• ${k}`).join("\n")
        : "Connect these ideas to your reading goals and the rest of the document.";
  } else {
    const single = paragraphs[0];
    const sentences = single
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0);
    if (sentences.length >= 3) {
      const n = Math.max(1, Math.ceil(sentences.length / 3));
      rows[0].body = sentences.slice(0, n).join(" ");
      rows[1].body = sentences.slice(n, n * 2).join(" ");
      rows[2].body = sentences.slice(n * 2).join(" ");
    } else {
      rows[0].body = single;
      rows[1].body =
        keyPoints[0] ?? "Use the key takeaways above to expand on this idea.";
      rows[2].body =
        keyPoints.slice(1).join(" ") ||
        "Ask yourself how this segment supports the document’s overall argument.";
    }
  }

  return rows;
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
  goDeeperButtonRef: React.RefObject<HTMLButtonElement | null>;
  keyPoints: string[];
}

function LessonContent({
  lesson,
  lessonIndex,
  totalLessons,
  isCompleted,
  isDark,
  deepDiveOpen,
  onGoDeeper,
  goDeeperButtonRef,
  keyPoints,
}: LessonContentProps) {
  const lessonRows = buildLessonRows(lesson.explanation ?? "", keyPoints);

  return (
    <div className="px-6 md:px-12 py-9 w-full">
      {/* Hero header */}
      <div
        className={cn(
          "mb-7 pb-6 border-b",
          isDark ? "border-white/10" : "border-black/10",
        )}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold mb-3"
          style={{
            background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
            boxShadow: "0 3px 10px rgba(59,130,246,0.4)",
          }}
        >
          {lessonIndex + 1}
        </div>
        <h1
          className="text-2xl font-bold leading-snug mb-2.5"
          style={{ color: isDark ? "#F1F5F9" : "#111827" }}
        >
          {lesson.title}
        </h1>
        <div className="flex flex-wrap gap-2 mt-2">
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{
              background: isDark ? "rgba(59,130,246,0.15)" : "#EFF6FF",
              color: "#3B82F6",
            }}
          >
            📖 Lesson {lessonIndex + 1} of {totalLessons}
          </span>
          {isCompleted && (
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: isDark ? "rgba(34,197,94,0.15)" : "#F0FDF4",
                color: "#16A34A",
              }}
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
          style={{
            background: isDark ? "rgba(59,130,246,0.08)" : "#EFF6FF",
            border: `1px solid ${isDark ? "rgba(59,130,246,0.2)" : "#BFDBFE"}`,
          }}
        >
          <p
            className="text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: "#3B82F6" }}
          >
            Key Takeaways
          </p>
          <ul className="space-y-2">
            {lesson.key_points.map((point, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm leading-relaxed"
                style={{ color: isDark ? "#94A3B8" : "#374151" }}
              >
                <span
                  className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: "#3B82F6" }}
                />
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Lesson content — three rows (segment-grounded) */}
      <div className="flex items-center gap-3 mb-5">
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: isDark ? "#94A3B8" : "#9CA3AF" }}
        >
          Lesson content
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB" }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 mb-8">
        {lessonRows.map((row, i) => (
          <div
            key={row.label}
            className={cn(
              "rounded-2xl border p-5 md:p-6 transition-shadow",
              isDark
                ? "border-white/10 bg-[#1e293b]/80 shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
                : "border-black/[0.06] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]",
            )}
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white",
                  i === 0 && "bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]",
                  i === 1 && "bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9]",
                  i === 2 && "bg-gradient-to-br from-[#059669] to-[#0D9488]",
                )}
              >
                {i + 1}
              </div>
              <div className="min-w-0">
                <p
                  className="text-[11px] font-bold uppercase tracking-wider mb-0.5"
                  style={{ color: isDark ? "#94A3B8" : "#6B7280" }}
                >
                  {row.subtitle}
                </p>
                <h2
                  className="text-base md:text-lg font-bold leading-snug"
                  style={{ color: isDark ? "#F1F5F9" : "#111827" }}
                >
                  {row.label}
                </h2>
              </div>
            </div>
            <div
              className="text-[15px] md:text-[16px] leading-[1.85] whitespace-pre-wrap pl-0 md:pl-12"
              style={{ color: isDark ? "#CBD5E1" : "#1F2937" }}
            >
              {row.body}
            </div>
          </div>
        ))}
      </div>

      {/* Go Deeper */}
      <div className="flex items-center gap-4 mt-2">
        <div
          className="flex-1 h-px"
          style={{ background: isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB" }}
        />
        <button
          ref={goDeeperButtonRef}
          onClick={onGoDeeper}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all hover:-translate-y-0.5"
          style={{
            background: isDark ? "rgba(139,92,246,0.15)" : "#F5F3FF",
            color: "#7C3AED",
            border: `1.5px dashed ${deepDiveOpen ? "#7c3aed" : "#c4b5fd"}`,
          }}
        >
          🔬 Go Deeper on this Lesson
          <span
            className="text-xs transition-transform duration-200"
            style={{
              display: "inline-block",
              transform: deepDiveOpen ? "rotate(180deg)" : "none",
            }}
          >
            ▾
          </span>
        </button>
        <div
          className="flex-1 h-px"
          style={{ background: isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB" }}
        />
      </div>
    </div>
  );
}

function LessonSkeleton({ isDark }: { isDark: boolean }) {
  const base = isDark ? "bg-white/10" : "bg-gray-200";
  return (
    <div className="px-6 md:px-12 py-9 max-w-3xl animate-pulse">
      <div className={cn("w-9 h-9 rounded-full mb-4", base)} />
      <div className={cn("h-7 rounded w-2/3 mb-3", base)} />
      <div className={cn("h-4 rounded w-1/4 mb-8", base)} />
      <div className={cn("h-24 rounded-xl mb-7", base)} />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn("h-4 rounded", base, i === 4 ? "w-1/2" : "w-full")}
          />
        ))}
      </div>
    </div>
  );
}

function LessonError({
  isDark,
  onBack,
}: {
  isDark: boolean;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="text-4xl mb-4">📚</div>
      <p
        className="font-semibold text-base mb-1"
        style={{ color: isDark ? "#F1F5F9" : "#111827" }}
      >
        Could not load lesson
      </p>
      <p
        className="text-sm mb-4"
        style={{ color: isDark ? "#94A3B8" : "#6B7280" }}
      >
        The lesson content couldn't be fetched. Try going back and reopening.
      </p>
      <button
        onClick={onBack}
        className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
        style={{ background: "#3B82F6" }}
      >
        ← Back to Roadmap
      </button>
    </div>
  );
}

// ─── Notes tab with "Last changed" timestamp ──────────────────────────────────
interface NotesTabProps {
  isDark: boolean;
  value: string;
  onChange: (v: string) => void;
  lastChanged: string;
}

function NotesTab({ isDark, value, onChange, lastChanged }: NotesTabProps) {
  return (
    <div
      className="flex-1 flex flex-col p-3"
      style={{ fontFamily: "Poppins, sans-serif" }}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Take notes here…"
        className={cn(
          "flex-1 w-full resize-none rounded-xl p-3 text-sm leading-relaxed outline-none",
          isDark
            ? "bg-[#0f172a] border-white/10 text-[#F1F5F9] placeholder:text-[#94A3B8] focus:ring-[#3B82F6]"
            : "bg-gray-50 border-black/10 text-[#111827] placeholder:text-[#6B7280] focus:ring-[#3B82F6]",
          "border focus:ring-1",
        )}
        style={{ fontFamily: "Poppins, sans-serif" }}
        aria-label="Lesson notes"
      />
      <div
        className={cn(
          "mt-2 flex items-center justify-between text-xs",
          isDark ? "text-[#94A3B8]" : "text-[#6B7280]",
        )}
      >
        <span className="flex items-center gap-1">
          {lastChanged ? (
            <>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
              Last changed: {lastChanged}
            </>
          ) : (
            <span className="opacity-60">Start typing to save notes…</span>
          )}
        </span>
      </div>
    </div>
  );
}
