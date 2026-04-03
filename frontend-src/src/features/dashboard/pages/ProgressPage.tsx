import { useNavigate } from 'react-router-dom';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { useDocuments } from '../../../shared/contexts/DocumentsContext';
import { cn } from '../../../shared/utils/cn';
import ProgressStats from '../components/ProgressStats';
import LessonProgressChart from '../components/LessonProgressChart';
import type { DocumentProgress } from '../../../shared/contexts/ProgressContext';

// ────────────────────────────────────────────────────────────────────
// Sub-component: individual per-document progress row
// ────────────────────────────────────────────────────────────────────

interface DocumentProgressRowProps {
  docProgress: DocumentProgress;
  docTitle: string;
}

function DocumentProgressRow({ docProgress, docTitle }: DocumentProgressRowProps) {
  const navigate = useNavigate();

  const { completedLessons, totalLessons, percentage, documentId } = docProgress;
  const completed = completedLessons.length;

  function handleContinue() {
    navigate(`/roadmap/${documentId}`);
  }

  return (
    <div
      className={cn(
        'bg-white dark:bg-[#1e293b] rounded-2xl p-4',
        'border border-black/5 dark:border-white/10',
        'flex flex-col gap-3'
      )}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[#111827] dark:text-[#F1F5F9] leading-snug line-clamp-2 flex-1">
          {docTitle}
        </p>
        <span className="text-xs font-bold text-[#3B82F6] dark:text-[#60A5FA] shrink-0">
          {percentage}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-[#E5E7EB] dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#3B82F6] transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[#6B7280] dark:text-[#94A3B8]">
          {completed}/{totalLessons} lessons
        </span>
        <button
          onClick={handleContinue}
          className={cn(
            'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer',
            'bg-[#89ADE2]/15 hover:bg-[#89ADE2]/30 text-[#3B82F6] dark:text-[#60A5FA]',
            'dark:bg-[#3B82F6]/15 dark:hover:bg-[#3B82F6]/25'
          )}
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-component: right-column document progress list
// ────────────────────────────────────────────────────────────────────

function DocumentProgressList() {
  const { documentProgress } = useProgressContext();
  const { documents } = useDocuments();

  const entries = Object.values(documentProgress).sort(
    (a, b) =>
      new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime()
  );

  if (entries.length === 0) {
    return (
      <div
        className={cn(
          'bg-white dark:bg-[#1e293b] rounded-2xl p-6',
          'border border-black/5 dark:border-white/10',
          'flex flex-col items-center justify-center text-center gap-3 min-h-[160px]'
        )}
      >
        <span className="text-4xl">📚</span>
        <p className="text-sm text-[#6B7280] dark:text-[#94A3B8] max-w-[220px]">
          No progress yet. Start reading to track your journey!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wide px-1">
        Documents
      </h2>
      {entries.map((dp) => {
        // dp.documentId is the PDF filename; d.id is a numeric Date.now() — match on filename instead
        const match = documents.find((d) => d.filename === dp.documentId);
        const docTitle = match?.title ?? 'Unknown Document';
        return (
          <DocumentProgressRow
            key={dp.documentId}
            docProgress={dp}
            docTitle={docTitle}
          />
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Main page export
// ────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  return (
    <div className="min-h-screen bg-[#F4F4F4] dark:bg-[#0f172a] px-0 py-6">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F1F5F9]">
          Progress
        </h1>
        <p className="text-sm text-[#6B7280] dark:text-[#94A3B8] mt-0.5">
          Track your learning activity and document progress.
        </p>
      </div>

      {/* 3-column responsive grid */}
      <div
        className={cn(
          'grid grid-cols-1 gap-6',
          'lg:grid-cols-[280px_1fr_280px]'
        )}
      >
        {/* Left — stats */}
        <aside>
          <ProgressStats />
        </aside>

        {/* Center — 7-day activity chart */}
        <section className="flex flex-col gap-6">
          <LessonProgressChart />

          {/* Longest streak badge */}
          <LongestStreakBanner />
        </section>

        {/* Right — per-document list */}
        <aside>
          <DocumentProgressList />
        </aside>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Small inline component: longest streak banner in center column
// ────────────────────────────────────────────────────────────────────

function LongestStreakBanner() {
  const { streak } = useProgressContext();

  return (
    <div
      className={cn(
        'bg-white dark:bg-[#1e293b] rounded-2xl p-5',
        'border border-black/5 dark:border-white/10',
        'flex items-center gap-4'
      )}
    >
      <div className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-2xl shrink-0">
        🏆
      </div>
      <div>
        <p className="text-xs font-medium text-[#6B7280] dark:text-[#94A3B8]">
          Longest Streak
        </p>
        <p className="text-xl font-bold text-[#111827] dark:text-[#F1F5F9]">
          {streak.longestStreak}{' '}
          <span className="text-sm font-medium text-[#6B7280] dark:text-[#94A3B8]">
            {streak.longestStreak === 1 ? 'day' : 'days'}
          </span>
        </p>
      </div>

      <div className="ml-auto">
        {streak.todayCompleted ? (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            Today done ✓
          </span>
        ) : (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#F4F4F4] dark:bg-white/10 text-[#6B7280] dark:text-[#94A3B8]">
            Keep going!
          </span>
        )}
      </div>
    </div>
  );
}
