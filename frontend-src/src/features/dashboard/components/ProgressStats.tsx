import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { cn } from '../../../shared/utils/cn';

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  accent: string;
}

function StatCard({ icon, label, value, accent }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-[#1e293b] rounded-2xl p-4',
        'border border-black/5 dark:border-white/10',
        'flex items-center gap-4'
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
    </div>
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

  const documentsStarted = Object.keys(documentProgress).length;

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
        label="Lessons Completed"
        value={String(completedLessonsCount)}
        accent="bg-green-100 dark:bg-green-900/30"
      />
      <StatCard
        icon="📄"
        label="Documents Started"
        value={String(documentsStarted)}
        accent="bg-blue-100 dark:bg-blue-900/30"
      />
      <StatCard
        icon="⏱️"
        label="Total Time Spent"
        value={formatTime(totalTimeSeconds)}
        accent="bg-purple-100 dark:bg-purple-900/30"
      />
      <StatCard
        icon="🔥"
        label="Current Streak"
        value={`${currentStreak} ${currentStreak === 1 ? 'day' : 'days'}`}
        accent="bg-orange-100 dark:bg-orange-900/30"
      />
    </div>
  );
}
