import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { cn } from '../../../shared/utils/cn';

const BAR_MAX_HEIGHT = 56;
const BAR_MIN_HEIGHT = 6;

/** Labels for weekActivity[i]: i=0 → 6 days ago, i=6 → today (matches ProgressContext.computeWeekActivity) */
function rollingDayLabels(): string[] {
  const labels: string[] = [];
  for (let idx = 0; idx < 7; idx++) {
    const d = new Date();
    d.setDate(d.getDate() - (6 - idx));
    labels.push(
      d.toLocaleDateString(undefined, { weekday: 'narrow' }).replace(/\.$/, '')
    );
  }
  return labels;
}

export default function LessonProgressChart() {
  const { streak } = useProgressContext();
  const { weekActivity } = streak;
  const dayLabels = useMemo(() => rollingDayLabels(), []);
  const todayIndex = 6;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'bg-white dark:bg-[#1e293b] rounded-2xl p-5',
        'border border-black/5 dark:border-white/10',
        'shadow-sm dark:shadow-none'
        
      )}
    >
      <h2 className="text-sm font-semibold text-[#111827] dark:text-[#F1F5F9] mb-1">
        7-Day Activity
      </h2>
      <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mb-5">
        Days you completed at least one lesson
      </p>

      <div className="flex items-end justify-between gap-2 h-21">
        {weekActivity.map((active, i) => {
          const isToday = i === todayIndex;
          const barHeight = active ? BAR_MAX_HEIGHT : BAR_MIN_HEIGHT;

          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <motion.button
                type="button"
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="w-full flex flex-col items-center gap-1 cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] rounded-lg"
                title={
                  isToday
                    ? active
                      ? 'Today — completed'
                      : 'Today — not yet'
                    : active
                      ? 'Completed'
                      : 'No activity'
                }
              >
                <motion.div
                  layout
                  className={cn(
                    'w-full max-w-[28px] mx-auto rounded-full transition-colors duration-300',
                    isToday
                      ? active
                        ? 'bg-[#3B82F6]'
                        : 'bg-[#3B82F6]/30 dark:bg-[#3B82F6]/20'
                      : active
                        ? 'bg-[#22C55E]'
                        : 'bg-[#E5E7EB] dark:bg-white/10'
                  )}
                  animate={{ height: barHeight }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                />
              </motion.button>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between gap-1 mt-2">
        {dayLabels.map((label, i) => (
          <span
            key={i}
            className={cn(
              'flex-1 min-w-0 text-center text-[10px] font-medium truncate',
              i === todayIndex
                ? 'text-[#3B82F6] dark:text-[#60A5FA]'
                : 'text-[#6B7280] dark:text-[#94A3B8]'
            )}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-black/5 dark:border-white/10">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
          <span className="text-[10px] text-[#6B7280] dark:text-[#94A3B8]">Active day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
          <span className="text-[10px] text-[#6B7280] dark:text-[#94A3B8]">Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#E5E7EB] dark:bg-white/20" />
          <span className="text-[10px] text-[#6B7280] dark:text-[#94A3B8]">Inactive</span>
        </div>
      </div>
    </motion.div>
  );
}
