import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { cn } from '../../../shared/utils/cn';
import { formatStudyDurationSeconds } from '../../../shared/utils/formatStudyDuration';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  accent: string;
  delay: number;
  tooltip?: React.ReactNode;
}

function StatCard({ icon, label, value, accent, delay, tooltip }: StatCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      whileTap={{ scale: 0.99 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative bg-white dark:bg-[#1e293b] rounded-2xl p-4',
        'border border-black/5 dark:border-white/10',
        'flex items-center gap-4',
        'shadow-sm dark:shadow-none',
        'cursor-default select-none'
      )}
    >
      <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0', accent)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#6B7280] dark:text-[#94A3B8] truncate">{label}</p>
        <p className="text-lg font-bold text-[#111827] dark:text-[#F1F5F9] leading-tight">{value}</p>
      </div>

      {tooltip && (
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute left-0 right-0 bottom-[calc(100%+8px)] z-50',
                'bg-[#1e293b] dark:bg-[#0f172a] text-white rounded-xl px-3 py-2.5',
                'shadow-xl border border-white/10 pointer-events-none'
              )}
            >
              {tooltip}
              <div
                className="absolute left-6 top-full w-0 h-0"
                style={{
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '6px solid #1e293b',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </motion.div>
  );
}

export default function ProgressStats() {
  const { lessonProgress, documentProgress, streak, dailyTimeSeconds } = useProgressContext();

  const completedLessonsCount = Object.values(lessonProgress).filter(lp => lp.isCompleted).length;
  const documentsTracked = Object.keys(documentProgress).length;
  const today = todayISO();
  const todaySeconds = dailyTimeSeconds?.[today] ?? 0;
  const currentStreak = streak.currentStreak;

  // Time until midnight reset
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msLeft = midnight.getTime() - now.getTime();
  const hoursLeft = Math.floor(msLeft / 3_600_000);
  const minutesLeft = Math.floor((msLeft % 3_600_000) / 60_000);
  const resetLabel = hoursLeft > 0
    ? `Resets in ${hoursLeft}h ${minutesLeft}m`
    : `Resets in ${minutesLeft}m`;

  return (
    <div className="flex flex-col gap-3 h-full">
      <StatCard
        icon="✅"
        label="Lessons completed"
        value={String(completedLessonsCount)}
        accent="bg-green-100 dark:bg-green-900/30"
        delay={0}
      />
      <StatCard
        icon="📄"
        label="Documents in progress"
        value={String(documentsTracked)}
        accent="bg-blue-100 dark:bg-blue-900/30"
        delay={0.05}
      />
      <StatCard
        icon="⏱️"
        label="Total time spent per day"
        value={formatStudyDurationSeconds(todaySeconds)}
        accent="bg-purple-100 dark:bg-purple-900/30"
        delay={0.1}
        tooltip={
          <div className="space-y-1">
            <p className="text-[12px] font-semibold text-white">Daily study time</p>
            <p className="text-[11px] text-slate-300 leading-snug">
              Time actively spent studying in the Roadmap &amp; Reader today.
            </p>
            <p className="text-[11px] font-medium text-purple-300 flex items-center gap-1 mt-1.5">
              🔄 {resetLabel} at midnight
            </p>
          </div>
        }
      />
      <StatCard
        icon="🔥"
        label="Current streak"
        value={`${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}`}
        accent="bg-orange-100 dark:bg-orange-900/30"
        delay={0.15}
      />
    </div>
  );
}