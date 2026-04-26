import { useEffect, useState } from "react";
import { generateQuiz, evaluateAnswer } from "../services/readerService";
import type { MicrotaskQuestion } from "../services/readerService";
import { cn } from "../../../shared/utils/cn";

const QUIZ_TYPES = [
  { id: "multiple_choice", label: "Multiple choice", icon: "◉" },
  { id: "true_false", label: "True / false", icon: "⊕" },
  { id: "identification", label: "Identification", icon: "◇" },
  { id: "short_answer", label: "Short answer", icon: "✎" },
  { id: "essay", label: "Essay", icon: "¶" },
];

interface QuizPanelProps {
  documentTitle: string;
  lessonTitle: string;
  lessonContent: string;
  isDark?: boolean;
  token?: string;
  restartSignal?: number;
  onSessionChange?: (inProgress: boolean) => void;
  onClose?: () => void;
}

type PanelState = "picker" | "loading" | "question" | "result" | "summary";

export default function QuizPanel({
  documentTitle,
  lessonTitle,
  lessonContent,
  isDark = false,
  token,
  restartSignal = 0,
  onSessionChange,
  onClose,
}: QuizPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>("picker");
  const [quizType, setQuizType] = useState("multiple_choice");
  const [quizMode, setQuizMode] = useState<"quick" | "custom">("quick");
  const [quizCount, setQuizCount] = useState(3);
  const [questions, setQuestions] = useState<MicrotaskQuestion[]>([]);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    feedback: string;
    correctAnswer: string;
  } | null>(null);
  const [askedQuestions, setAskedQuestions] = useState<string[]>([]);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [evaluating, setEvaluating] = useState(false);

  const currentQuestion = questions[questionIdx];
  const inProgress =
    panelState === "loading" ||
    panelState === "question" ||
    panelState === "result";

  const resetQuiz = () => {
    setPanelState("picker");
    setQuizType("multiple_choice");
    setQuizMode("quick");
    setQuizCount(3);
    setQuestions([]);
    setQuestionIdx(0);
    setUserAnswer("");
    setSelectedOption(null);
    setFeedback(null);
    setAskedQuestions([]);
    setScore({ correct: 0, total: 0 });
    setEvaluating(false);
    onSessionChange?.(false);
  };

  useEffect(() => {
    onSessionChange?.(inProgress);
  }, [inProgress, onSessionChange]);

  useEffect(() => {
    if (restartSignal > 0) {
      resetQuiz();
    }
  }, [restartSignal]);

  const startQuiz = async () => {
    setPanelState("loading");
    setFeedback(null);
    setSelectedOption(null);
    setUserAnswer("");
    const count = quizMode === "quick" ? 1 : quizCount;
    const result = await generateQuiz(
      lessonTitle,
      lessonContent,
      documentTitle,
      quizType,
      count,
      askedQuestions,
      token,
    );
    if (result.success && result.tasks && result.tasks.length > 0) {
      const seen = new Set(askedQuestions.map((q) => q.toLowerCase().trim()));
      const deduped = result.tasks.filter((t) => {
        const k = (t.question ?? "").toLowerCase().trim();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (deduped.length === 0) {
        setPanelState("summary");
        return;
      }
      setQuestions(deduped);
      setQuestionIdx(0);
      setAskedQuestions((prev) => [...prev, ...deduped.map((t) => t.question)]);
      setScore({ correct: 0, total: 0 });
      setPanelState("question");
    } else {
      setPanelState("picker");
    }
  };

  const submitAnswer = async () => {
    if (!currentQuestion) return;
    const answerPayload =
      currentQuestion.type === "multiple_choice" ||
      currentQuestion.type === "true_false"
        ? selectedOption !== null
          ? selectedOption
          : ""
        : userAnswer.trim();
    if (answerPayload === "" || answerPayload === null) return;

    setEvaluating(true);
    const result = await evaluateAnswer(
      currentQuestion,
      answerPayload,
      lessonTitle,
      lessonContent,
      token,
    );
    setEvaluating(false);
    setFeedback({
      isCorrect: result.isCorrect ?? false,
      feedback: result.feedback ?? "",
      correctAnswer: result.correctAnswer ?? "",
    });
    setScore((prev) => ({
      correct: prev.correct + (result.isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
    setPanelState("result");
  };

  const nextQuestion = async () => {
    if (questionIdx + 1 < questions.length) {
      setQuestionIdx((i) => i + 1);
      setFeedback(null);
      setSelectedOption(null);
      setUserAnswer("");
      setPanelState("question");
    } else {
      if (quizMode === "quick") {
        setPanelState("loading");
        setFeedback(null);
        setSelectedOption(null);
        setUserAnswer("");
        const result = await generateQuiz(
          lessonTitle,
          lessonContent,
          documentTitle,
          quizType,
          1,
          askedQuestions,
          token,
        );
        if (result.success && result.tasks && result.tasks.length > 0) {
          const seen = new Set(
            askedQuestions.map((q) => q.toLowerCase().trim()),
          );
          const deduped = result.tasks.filter((t) => {
            const k = (t.question ?? "").toLowerCase().trim();
            if (!k || seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          if (deduped.length > 0) {
            setQuestions(deduped);
            setQuestionIdx(0);
            setAskedQuestions((prev) => [
              ...prev,
              ...deduped.map((t) => t.question),
            ]);
            setPanelState("question");
            return;
          }
        }
        setPanelState("picker");
      } else {
        setPanelState("summary");
      }
    }
  };

  const shell = "flex flex-col min-h-0 max-h-[min(82vh,680px)]";
  const headerBar = cn(
    "shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b",
    isDark
      ? "border-white/10 bg-gradient-to-r from-blue-900/40 to-indigo-950/30"
      : "border-blue-100/80 bg-gradient-to-r from-blue-50 to-indigo-50/90",
  );

  const CloseBtn = () =>
    onClose ? (
      <button
        type="button"
        onClick={onClose}
        className={cn(
          "shrink-0 rounded-xl p-2 text-lg leading-none transition-colors cursor-pointer",
          isDark
            ? "text-zinc-400 hover:bg-white/10 hover:text-white"
            : "text-zinc-500 hover:bg-black/5 hover:text-zinc-900",
        )}
        aria-label="Close quiz"
      >
        ✕
      </button>
    ) : null;

  if (panelState === "picker") {
    return (
      <div className={cn(shell, isDark ? "bg-[#0f1419]" : "bg-white")}>
        <div className={headerBar}>
          <div className="min-w-0">
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.18em] mb-1",
                isDark ? "text-blue-200/70" : "text-blue-800/80",
              )}
            >
              Quiz · This segment
            </p>
            <h3
              className={cn(
                "text-base font-bold leading-snug line-clamp-2",
                isDark ? "text-white" : "text-zinc-900",
              )}
            >
              {lessonTitle}
            </h3>
            <p
              className={cn(
                "text-xs mt-1 truncate",
                isDark ? "text-zinc-500" : "text-zinc-500",
              )}
              title={documentTitle}
            >
              {documentTitle}
            </p>
          </div>
          <CloseBtn />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <div>
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wide mb-2",
                isDark ? "text-zinc-500" : "text-zinc-500",
              )}
            >
              Question type
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUIZ_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setQuizType(t.id)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all cursor-pointer",
                    quizType === t.id
                      ? isDark
                        ? "border-blue-400/60 bg-blue-500/15 text-blue-100 ring-1 ring-blue-400/30"
                        : "border-blue-400 bg-blue-50 text-blue-950 ring-1 ring-blue-200"
                      : isDark
                        ? "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                        : "border-zinc-200 bg-zinc-50/80 text-zinc-700 hover:border-zinc-300",
                  )}
                >
                  <span className="mr-1.5 opacity-80">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wide mb-2",
                isDark ? "text-zinc-500" : "text-zinc-500",
              )}
            >
              Mode
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setQuizMode("quick")}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all cursor-pointer",
                  quizMode === "quick"
                    ? isDark
                      ? "border-sky-500/50 bg-sky-500/10 ring-1 ring-sky-400/20"
                      : "border-sky-300 bg-sky-50 ring-1 ring-sky-100"
                    : isDark
                      ? "border-white/10 hover:bg-white/5"
                      : "border-zinc-200 hover:bg-zinc-50",
                )}
              >
                <p
                  className={cn(
                    "text-sm font-bold",
                    isDark ? "text-sky-200" : "text-sky-900",
                  )}
                >
                  Quick
                </p>
                <p
                  className={cn(
                    "text-[11px] mt-1 leading-relaxed",
                    isDark ? "text-zinc-400" : "text-zinc-600",
                  )}
                >
                  One question at a time — stay in flow.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setQuizMode("custom")}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all cursor-pointer",
                  quizMode === "custom"
                    ? isDark
                      ? "border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-400/20"
                      : "border-blue-300 bg-blue-50 ring-1 ring-blue-100"
                    : isDark
                      ? "border-white/10 hover:bg-white/5"
                      : "border-zinc-200 hover:bg-zinc-50",
                )}
              >
                <p
                  className={cn(
                    "text-sm font-bold",
                    isDark ? "text-blue-200" : "text-[#629af4]",
                  )}
                >
                  Custom
                </p>
                <p
                  className={cn(
                    "text-[11px] mt-1 leading-relaxed",
                    isDark ? "text-zinc-400" : "text-zinc-600",
                  )}
                >
                  Set how many questions in one run.
                </p>
              </button>
            </div>
            {quizMode === "custom" && (
              <div className="mt-4 flex items-center gap-3">
                <span
                  className={cn(
                    "text-xs",
                    isDark ? "text-zinc-400" : "text-zinc-600",
                  )}
                >
                  Questions
                </span>
                <input
                  type="range"
                  min={2}
                  max={10}
                  value={quizCount}
                  onChange={(e) => setQuizCount(Number(e.target.value))}
                  className="flex-1 accent-blue-600"
                />
                <span
                  className={cn(
                    "text-sm font-bold tabular-nums w-6",
                    isDark ? "text-white" : "text-zinc-900",
                  )}
                >
                  {quizCount}
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            "shrink-0 px-5 pb-5 pt-0",
            isDark ? "border-t border-white/10" : "border-t border-zinc-100",
          )}
        >
          <button
            type="button"
            onClick={startQuiz}
            className={cn(
              "w-full py-3.5 rounded-2xl text-sm font-bold text-white shadow-lg transition-transform active:scale-[0.99] cursor-pointer",
              "bg-linear-to-r from-[#4F7CDD] via-[#3B82F6] to-[#1D4ED8] hover:brightness-105 shadow-blue-500/25",
            )}
          >
            {quizMode === "quick"
              ? "Start quick quiz"
              : `Start ${quizCount}-question quiz`}
          </button>
        </div>
      </div>
    );
  }

  if (panelState === "loading") {
    return (
      <div
        className={cn(
          shell,
          "relative items-center justify-center py-16",
          isDark ? "bg-[#0f1419]" : "bg-white",
        )}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "absolute right-4 top-4 rounded-xl p-2 text-lg leading-none z-10 cursor-pointer",
              isDark
                ? "text-zinc-400 hover:bg-white/10 hover:text-white"
                : "text-zinc-500 hover:bg-black/5",
            )}
            aria-label="Close quiz"
          >
            ✕
          </button>
        )}
        <div className="flex flex-col items-center gap-4 px-6">
          <div
            className={cn(
              "h-12 w-12 rounded-full border-2 border-t-transparent animate-spin",
              isDark ? "border-blue-400" : "border-blue-600",
            )}
          />
          <p
            className={cn(
              "text-sm font-medium",
              isDark ? "text-zinc-400" : "text-zinc-600",
            )}
          >
            Generating questions from your segment…
          </p>
        </div>
      </div>
    );
  }

  if (panelState === "summary") {
    const pct =
      score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <div
        className={cn(shell, "relative", isDark ? "bg-[#0f1419]" : "bg-white")}
      >
        {/* 1. Header with Left-Aligned Text */}
        <div className={headerBar}>
          <div className="min-w-0 flex-1 text-left">
            <p
              className={cn(
                "text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5",
                isDark ? "text-blue-200/70" : "text-blue-800/80",
              )}
            >
              Results
            </p>
            <h3
              className={cn(
                "text-base font-bold leading-snug",
                isDark ? "text-white" : "text-zinc-900",
              )}
            >
              Quiz Summary
            </h3>
          </div>
          <CloseBtn />
        </div>

        {/* 2. Centered Content Body */}
        <div className="flex flex-col items-center justify-center flex-1 gap-4 px-8 py-10 text-center overflow-y-auto">
          {/* --- PENGUIN IMAGE CONDITIONAL RENDERING --- */}
          {pct >= 80 && (
            <div className="w-32 h-32 flex items-center justify-center">
              <img
                src="https://raw.githubusercontent.com/lycos-dev/docvia-backend/refs/heads/waru-branch/frontend-src/public/assets/images/happy-Photoroom.png"
                alt="Happy Penguin"
                className="max-h-full w-auto object-contain"
              />
            </div>
          )}

          {pct >= 50 && pct < 80 && (
            <div className="w-32 h-32 flex items-center justify-center">
              <img
                src="https://github.com/lycos-dev/docvia-backend/blob/waru-branch/frontend-src/public/assets/images/nani-Photoroom.png?raw=true"
                alt="Shoulders Up Penguin"
                className="max-h-full w-auto object-contain"
              />
            </div>
          )}

          {pct < 50 && (
            <div className="w-32 h-32 flex items-center justify-center">
              <img
                src="https://raw.githubusercontent.com/lycos-dev/docvia-backend/refs/heads/waru-branch/frontend-src/public/assets/images/sad-Photoroom.png"
                alt="Sad Penguin"
                className="max-h-full w-auto object-contain"
              />
            </div>
          )}
          {/* ------------------------------------------- */}

          <div
            className={cn(
              "text-5xl font-black tabular-nums bg-clip-text text-transparent",
              isDark
                ? "bg-linear-to-br from-emerald-300 to-sky-400"
                : "bg-linear-to-br from-emerald-600 to-sky-600",
            )}
            style={{ WebkitBackgroundClip: "text" }}
          >
            {pct}%
          </div>
          <p
            className={cn(
              "text-sm",
              isDark ? "text-zinc-400" : "text-zinc-600",
            )}
          >
            {score.correct} / {score.total} correct
          </p>
          {/* 1. High Score: 80% and above */}
          {pct >= 80 && (
            <p className="text-sm font-semibold text-emerald-500 dark:text-emerald-400">
              Great work! You've mastered this segment.
            </p>
          )}

          {/* 2. Passing/Middle: 50% to 79% */}
          {pct >= 50 && pct < 80 && (
            <p className="text-sm font-medium text-blue-500 dark:text-blue-400">
              Good effort! A little more review and you'll have it.
            </p>
          )}

          {/* 3. Room for Improvement: Below 50% (including 0%) */}
          {pct < 50 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Keep going — review the segment and try again.
            </p>
          )}
          <button
            type="button"
            onClick={resetQuiz}
            className="mt-2 px-8 py-3 rounded-2xl text-sm font-bold text-white bg-linear-to-r from-blue-600 to-indigo-600 hover:brightness-105 shadow-lg shadow-blue-500/20 cursor-pointer"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const isMC =
    currentQuestion?.type === "multiple_choice" ||
    currentQuestion?.type === "true_false";
  const isTextAnswer = !isMC;
  const totalQ = questions.length;

  return (
    <div className={cn(shell, isDark ? "bg-[#0f1419]" : "bg-white")}>
      <div className={headerBar}>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[10px] font-bold uppercase tracking-[0.18em] mb-0.5",
              isDark ? "text-blue-200/70" : "text-blue-800/80",
            )}
          >
            {quizMode === "quick" ? "Quick quiz" : "Custom quiz"}
          </p>
          <p
            className={cn(
              "text-xs line-clamp-1",
              isDark ? "text-zinc-500" : "text-zinc-500",
            )}
            title={lessonTitle}
          >
            {lessonTitle}
          </p>
        </div>
        <CloseBtn />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {totalQ > 0 && (
          <div>
            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wide mb-1.5">
              <span className={isDark ? "text-zinc-500" : "text-zinc-500"}>
                Question {questionIdx + 1} of {totalQ}
              </span>
              <span className={isDark ? "text-zinc-500" : "text-zinc-500"}>
                {totalQ > 1
                  ? Math.round(((questionIdx + 1) / totalQ) * 100)
                  : 100}
                %
              </span>
            </div>
            <div
              className={cn(
                "h-2 rounded-full overflow-hidden",
                isDark ? "bg-zinc-800" : "bg-zinc-100",
              )}
            >
              <div
                className="h-full rounded-full bg-linear-to-r from-blue-500 to-green-500 transition-all duration-300"
                style={{
                  width: `${totalQ > 1 ? ((questionIdx + 1) / totalQ) * 100 : 100}%`,
                }}
              />
            </div>
          </div>
        )}

        <p
          className={cn(
            "text-[15px] md:text-base font-semibold leading-relaxed",
            isDark ? "text-zinc-100" : "text-zinc-900",
          )}
        >
          {currentQuestion?.question}
        </p>

        {isMC && panelState === "question" && currentQuestion && (
          <div className="space-y-2">
            {currentQuestion.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedOption(i)}
                className={cn(
                  "w-full text-left rounded-xl border px-4 py-3 text-sm transition-all cursor-pointer flex items-start gap-2",
                  selectedOption === i
                    ? isDark
                      ? "border-blue-400 bg-blue-500/15 text-white ring-1 ring-blue-400/40"
                      : "border-blue-400 bg-blue-50 text-zinc-900 ring-1 ring-blue-200"
                    : isDark
                      ? "border-white/10 bg-white/3 text-zinc-200 hover:bg-white/10"
                      : "border-zinc-200 bg-zinc-50/50 text-zinc-800 hover:border-zinc-300",
                )}
              >
                <span className="font-bold mr-2 text-blue-600 dark:text-blue-400">
                  {currentQuestion.type === "true_false"
                    ? i === 0
                      ? "T"
                      : "F"
                    : String.fromCharCode(65 + i)}
                  .
                </span>
                {opt.replace(/^[A-DFT]\.\s*/, "")}
              </button>
            ))}
          </div>
        )}

        {isTextAnswer && panelState === "question" && (
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Type your answer…"
            rows={4}
            className={cn(
              "w-full resize-none rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2",
              isDark
                ? "border-white/10 bg-[#1a1f26] text-zinc-100 placeholder:text-zinc-600 focus:ring-blue-500/30"
                : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:ring-blue-500/30",
            )}
          />
        )}

        {panelState === "question" && (
          <button
            type="button"
            onClick={submitAnswer}
            disabled={
              evaluating ||
              (isMC ? selectedOption === null : !userAnswer.trim())
            }
            className={cn(
              "w-full py-3 rounded-2xl text-sm font-bold text-white transition-opacity cursor-pointer hover:brightness-90",
              "bg-linear-to-r from-blue-600 to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20",
            )}
          >
            {evaluating ? "Checking…" : "Submit answer"}
          </button>
        )}

        {panelState === "result" && feedback && (
          <div
            className={cn(
              "rounded-2xl border p-4 text-sm",
              feedback.isCorrect
                ? isDark
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-950"
                : isDark
                  ? "border-red-500/40 bg-red-500/10 text-red-100"
                  : "border-red-200 bg-red-50 text-red-950",
            )}
          >
            <p className="font-bold mb-1">
              {feedback.isCorrect ? "Correct" : "Not quite"}
            </p>
            {feedback.feedback && (
              <p className="text-xs opacity-95 leading-relaxed">
                {feedback.feedback}
              </p>
            )}
            {!feedback.isCorrect && feedback.correctAnswer && (
              <p className="text-xs mt-2 opacity-90">
                Expected:{" "}
                <span className="font-semibold">{feedback.correctAnswer}</span>
              </p>
            )}
          </div>
        )}

        {panelState === "result" && (
          <button
            type="button"
            onClick={nextQuestion}
            className={cn(
              "w-full py-3 rounded-2xl text-sm font-bold text-white cursor-pointer",
              "bg-blue-800 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600",
            )}
          >
            {questionIdx + 1 < questions.length
              ? "Next question"
              : quizMode === "quick"
                ? "Another question"
                : "View results"}
          </button>
        )}
      </div>
    </div>
  );
}