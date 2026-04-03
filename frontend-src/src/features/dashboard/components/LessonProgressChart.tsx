import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { cn } from '../../../shared/utils/cn';

const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;

const BAR_MAX_HEIGHT = 56; // px
const BAR_MIN_HEIGHT = 6;  // px

export default function LessonProgressChart() {
  const { streak } = useProgressContext();
  const { weekActivity } = streak;

  // weekActivity[0] = Mon of the current week window (6 days ago → today)
  // Determine which index corresponds to today (always the last element = index 6)
  const todayIndex = 6;

  return (
    <div
      className={cn(
        'bg-white dark:bg-[#1e293b] rounded-2xl p-5',
        'border border-black/5 dark:border-white/10'
      )}
    >
      <h2 className="text-sm font-semibold text-[#111827] dark:text-[#F1F5F9] mb-1">
        7-Day Activity
      </h2>
      <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mb-5">
        Days you completed at least one lesson
      </p>

      {/* Bar chart */}
      <div className="flex items-end justify-between gap-2 h-[72px]">
        {weekActivity.map((active, i) => {
          const isToday = i === todayIndex;
          const barHeight = active ? BAR_MAX_HEIGHT : BAR_MIN_HEIGHT;

          return (
            <div
              key={DAY_LABELS[i]}
              className="flex flex-col items-center gap-1 flex-1"
            >
              <div
                className={cn(
                  'w-full rounded-full transition-all duration-500',
                  isToday
                    ? active
                      ? 'bg-[#3B82F6]'
                      : 'bg-[#3B82F6]/30 dark:bg-[#3B82F6]/20'
                    : active
                    ? 'bg-[#22C55E]'
                    : 'bg-[#E5E7EB] dark:bg-white/10'
                )}
                style={{ height: `${barHeight}px` }}
                title={
                  isToday
                    ? active
                      ? 'Today — completed'
                      : 'Today — not yet'
                    : active
                    ? 'Completed'
                    : 'No activity'
                }
              />
            </div>
          );
        })}
      </div>

      {/* Day labels */}
      <div className="flex justify-between gap-2 mt-2">
        {DAY_LABELS.map((label, i) => (
          <span
            key={label}
            className={cn(
              'flex-1 text-center text-[10px] font-medium',
              i === todayIndex
                ? 'text-[#3B82F6] dark:text-[#60A5FA]'
                : 'text-[#6B7280] dark:text-[#94A3B8]'
            )}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-black/5 dark:border-white/10">
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
    </div>
  );
}
