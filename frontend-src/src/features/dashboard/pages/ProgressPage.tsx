import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  const safeTotal = totalLessons > 0 ? totalLessons : 0;
  const displayPct =
    safeTotal > 0 ? Math.min(100, Math.round((completed / safeTotal) * 100)) : Math.min(100, percentage);

  function handleContinue() {
    navigate(`/roadmap/${encodeURIComponent(documentId)}`);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
      className={cn(
        'bg-white dark:bg-[#1e293b] rounded-2xl p-4',
        'border border-black/5 dark:border-white/10',
        'flex flex-col gap-3',
        'shadow-sm dark:shadow-none'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[#111827] dark:text-[#F1F5F9] leading-snug line-clamp-2 flex-1">
          {docTitle}
        </p>
        <span className="text-xs font-bold text-[#3B82F6] dark:text-[#60A5FA] shrink-0 tabular-nums">
          {displayPct}%
        </span>
      </div>

      <div className="h-2 w-full rounded-full bg-[#E5E7EB] dark:bg-white/10 overflow-hidden ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#6366F1]"
          initial={false}
          animate={{ width: `${displayPct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 26 }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[#6B7280] dark:text-[#94A3B8] tabular-nums">
          {safeTotal > 0 ? `${completed}/${safeTotal} lessons` : `${completed} lesson${completed === 1 ? '' : 's'} done`}
        </span>
        <motion.button
          type="button"
          onClick={handleContinue}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            'text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer',
            'bg-[#89ADE2]/15 hover:bg-[#89ADE2]/30 text-[#3B82F6] dark:text-[#60A5FA]',
            'dark:bg-[#3B82F6]/15 dark:hover:bg-[#3B82F6]/25'
          )}
        >
          Continue →
        </motion.button>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sub-component: right-column document progress list
// ────────────────────────────────────────────────────────────────────

function DocumentProgressList() {
  const { documentProgress } = useProgressContext();
  const { documents } = useDocuments();

  const entries = Object.values(documentProgress).sort((a, b) => {
    const aMs = Date.parse(a.lastAccessedAt);
    const bMs = Date.parse(b.lastAccessedAt);
    const aT = Number.isNaN(aMs) ? 0 : aMs;
    const bT = Number.isNaN(bMs) ? 0 : bMs;
    return bT - aT;
  });

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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.01 }}
      className={cn(
        'bg-white dark:bg-[#1e293b] rounded-2xl p-5',
        'border border-black/5 dark:border-white/10',
        'flex items-center gap-4',
        'shadow-sm dark:shadow-none'
      )}
    >
      <motion.div
        animate={{ rotate: [0, -6, 6, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
        className="h-12 w-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-2xl shrink-0"
      >
        🏆
      </motion.div>
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
    </motion.div>
  );
}
