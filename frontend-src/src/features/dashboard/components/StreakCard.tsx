import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { cn } from '../../../shared/utils/cn';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function localDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getLast7Days(): Array<{ iso: string; short: string; full: string; isToday: boolean }> {
  const today = new Date();
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    result.push({
      iso:     localDateISO(d),
      short:   DAY_SHORT[d.getDay()],
      full:    i === 0 ? 'Today' : i === 1 ? 'Yesterday' : DAY_FULL[d.getDay()],
      isToday: i === 0,
    });
  }
  return result;
}

function formatTime(s: number): string {
  if (s <= 0)   return '—';
  if (s < 60)   return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function getMilestoneMessage(streak: number): string {
  if (streak >= 30) return "Monthly champion! 🏆";
  if (streak >= 14) return "Two weeks unstoppable! 🔥";
  if (streak >= 7)  return "One week strong! 💪";
  if (streak >= 3)  return "You're on a roll! 🚀";
  return "Keep it up!";
}

// ─── Day pill component ───────────────────────────────────────────────────────

interface DayPillProps {
  day:       { iso: string; short: string; full: string; isToday: boolean };
  active:    boolean;
  lessons:   number;
  seconds:   number;
}

function DayPill({ day, active, lessons, seconds }: DayPillProps) {
  const [hovered, setHovered] = useState(false);

  // Intensity ring based on time studied (0 = none, 1 = <15m, 2 = <30m, 3 = 30m+)
  const intensity =
    seconds <= 0       ? 0 :
    seconds < 15 * 60  ? 1 :
    seconds < 30 * 60  ? 2 : 3;

  const ringColors = [
    '',                                               // 0 – inactive
    'ring-2 ring-green-300 dark:ring-green-600',      // 1 – light
    'ring-2 ring-green-400 dark:ring-green-500',      // 2 – medium
    'ring-2 ring-green-500 dark:ring-green-400',      // 3 – heavy
  ];

  return (
    <div
      className="relative flex flex-col items-center gap-1.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Day label */}
      <span className={cn(
        'text-[10px] font-semibold transition-colors',
        day.isToday
          ? 'text-orange-500 dark:text-orange-400'
          : 'text-gray-400 dark:text-gray-500'
      )}>
        {day.short}
      </span>

      {/* Dot */}
      <div className={cn(
        'w-8 h-8 rounded-full transition-all duration-300 flex items-center justify-center',
        active
          ? 'bg-green-400 dark:bg-green-500 shadow-lg shadow-green-400/30'
          : 'bg-gray-200 dark:bg-gray-700',
        day.isToday && 'ring-2 ring-orange-400 ring-offset-2 dark:ring-offset-gray-800',
        // intensity ring only when active and not today (today already has orange ring)
        active && !day.isToday && ringColors[intensity],
      )}>
        {active && (
          <span className="text-white text-[10px] font-bold">
            {lessons > 0 ? lessons : '✓'}
          </span>
        )}
      </div>

      {/* Hover detail card */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 4,  scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute bottom-[calc(100%+10px)] z-50 w-44',
              'bg-[#1e293b] dark:bg-[#0f172a] rounded-xl p-3',
              'shadow-2xl border border-white/10 pointer-events-none',
              // keep cards inside view — first 3 align left, last 4 align right
            )}
            style={{ left: '50%', transform: 'translateX(-50%)' }}
          >
            {/* Day name */}
            <p className="text-[11px] font-bold text-white mb-2">{day.full}</p>

            {active ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Lessons done</span>
                  <span className="text-[11px] font-semibold text-green-400">
                    {lessons > 0 ? `${lessons} lesson${lessons > 1 ? 's' : ''}` : '✓ Active'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Time studied</span>
                  <span className="text-[11px] font-semibold text-purple-400">
                    {formatTime(seconds)}
                  </span>
                </div>
                {/* Mini intensity bar */}
                <div className="mt-2">
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, (seconds / (30 * 60)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1 text-right">
                    {intensity === 3 ? 'Great session! 🎉' : intensity === 2 ? 'Good progress' : 'Light study'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 italic">No activity</p>
            )}

            {/* Arrow */}
            <div
              className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft:  '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop:   '5px solid #1e293b',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StreakCard() {
  const { streak, dailyCompletions, dailyTimeSeconds } = useProgressContext();
  const days = getLast7Days();

  const flameScale    = Math.min(1 + streak.currentStreak * 0.02, 1.5);
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

      {/* ── 7-day interactive activity grid ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            This week
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
            Hover a day for details
          </p>
        </div>

        <div className="flex items-end justify-between gap-1 px-1">
          {days.map((day, index) => (
            <DayPill
              key={day.iso}
              day={day}
              active={streak.weekActivity[index] ?? false}
              lessons={dailyCompletions?.[day.iso] ?? 0}
              seconds={dailyTimeSeconds?.[day.iso] ?? 0}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
            <span className="text-[9px] text-gray-400 dark:text-gray-500">No activity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-400 dark:bg-green-500" />
            <span className="text-[9px] text-gray-400 dark:text-gray-500">Active</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-2.5 h-2.5 rounded-full ring-2 ring-orange-400 bg-transparent" />
            <span className="text-[9px] text-gray-400 dark:text-gray-500">Today</span>
          </div>
        </div>
      </div>

      {/* Today status / streak broken */}
      {isStreakBroken ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400 text-center mb-2">
            Streak lost — start again today!
          </p>
          <button className="w-full py-1.5 px-3 rounded-lg bg-amber-400 dark:bg-amber-500 text-white text-sm font-semibold hover:bg-amber-500 dark:hover:bg-amber-400 transition-colors cursor-pointer">
            Restart Streak
          </button>
        </div>
      ) : (
        <div className={cn(
          'p-4 rounded-2xl',
          streak.todayCompleted ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'
        )}>
          <p className={cn(
            'text-sm font-medium text-center',
            streak.todayCompleted ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
          )}>
            {streak.todayCompleted ? '✅ Today completed!' : "⏳ Complete today's reading"}
          </p>
        </div>
      )}
    </div>
  );
}