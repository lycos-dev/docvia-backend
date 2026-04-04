import { motion } from 'framer-motion';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { cn } from '../../../shared/utils/cn';

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  accent: string;
  delay: number;
}

function StatCard({ icon, label, value, accent, delay }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.02, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'bg-white dark:bg-[#1e293b] rounded-2xl p-4',
        'border border-black/5 dark:border-white/10',
        'flex items-center gap-4',
        'shadow-sm dark:shadow-none',
        'cursor-default'
      )}
    >
      <div
        className={cn(
          'h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0',
          accent
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#6B7280] dark:text-[#94A3B8] truncate">{label}</p>
        <p className="text-lg font-bold text-[#111827] dark:text-[#F1F5F9] leading-tight">{value}</p>
      </div>
    </motion.div>
  );
}

function formatTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export default function ProgressStats() {
  const { lessonProgress, documentProgress, streak } = useProgressContext();

  const completedLessonsCount = Object.values(lessonProgress).filter(
    (lp) => lp.isCompleted
  ).length;

  const documentsTracked = Object.keys(documentProgress).length;

  const totalTimeSeconds = Object.values(lessonProgress).reduce(
    (sum, lp) => sum + lp.timeSpentSeconds,
    0
  );

  const currentStreak = streak.currentStreak;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-[#6B7280] dark:text-[#94A3B8] uppercase tracking-wide px-1">
        Your Stats
      </h2>

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
        label="Total time spent"
        value={formatTime(totalTimeSeconds)}
        accent="bg-purple-100 dark:bg-purple-900/30"
        delay={0.1}
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
