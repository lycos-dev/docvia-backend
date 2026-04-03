import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { cn } from '../../../shared/utils/cn';

// Ordered by JS getDay(): 0=Sun, 1=Mon, ... 6=Sat
const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// weekActivity[0] = 6 days ago, weekActivity[6] = today — labels must match actual days
function getLast7DayLabels(): string[] {
  const today = new Date();
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    labels.push(DAY_SHORT[d.getDay()]);
  }
  return labels;
}

function getMilestoneMessage(currentStreak: number): string {
  if (currentStreak >= 30) return "Monthly champion! 🏆";
  if (currentStreak >= 14) return "Two weeks! You're unstoppable! 🔥";
  if (currentStreak >= 7)  return "One week strong! 💪";
  if (currentStreak >= 3)  return "You're on a roll! 🚀";
  return "Keep it up!";
}

export default function StreakCard() {
  const { streak } = useProgressContext();
  const dayLabels = getLast7DayLabels();

  const flameScale = Math.min(1 + streak.currentStreak * 0.02, 1.5);
  const isStreakBroken = streak.currentStreak === 0 && streak.longestStreak > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
          <span
            className="text-2xl transition-transform duration-500"
            style={{ transform: `scale(${flameScale})` }}
          >
            🔥
          </span>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Your Streak</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {getMilestoneMessage(streak.currentStreak)}
          </p>
        </div>
      </div>

      {/* Streak stats */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Streak</span>
          <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {streak.currentStreak} days
          </span>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Longest Streak</span>
          <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {streak.longestStreak} days
          </span>
        </div>
      </div>

      {/* 7-day activity grid */}
      <div className="mb-5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">This week</p>
        <div className="flex items-center justify-between gap-1">
          {streak.weekActivity.map((active, index) => {
            const isToday = index === 6;
            return (
              <div key={index} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                  {dayLabels[index]}
                </span>
                <div
                  className={cn(
                    'w-7 h-7 rounded-full transition-colors duration-300',
                    active
                      ? 'bg-green-400 dark:bg-green-500'
                      : 'bg-gray-200 dark:bg-gray-700',
                    isToday && 'ring-2 ring-orange-400 animate-pulse'
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Today status or streak broken warning */}
      {isStreakBroken ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400 text-center mb-2">
            Streak lost — start again today!
          </p>
          <button
            className="w-full py-1.5 px-3 rounded-lg bg-amber-400 dark:bg-amber-500 text-white text-sm font-semibold hover:bg-amber-500 dark:hover:bg-amber-400 transition-colors cursor-pointer"
          >
            Restart Streak
          </button>
        </div>
      ) : (
        <div
          className={cn(
            'p-4 rounded-2xl',
            streak.todayCompleted
              ? 'bg-green-50 dark:bg-green-900/20'
              : 'bg-gray-50 dark:bg-gray-700/50'
          )}
        >
          <p
            className={cn(
              'text-sm font-medium text-center',
              streak.todayCompleted
                ? 'text-green-700 dark:text-green-400'
                : 'text-gray-600 dark:text-gray-400'
            )}
          >
            {streak.todayCompleted ? '✅ Today completed!' : "⏳ Complete today's reading"}
          </p>
        </div>
      )}
    </div>
  );
}
