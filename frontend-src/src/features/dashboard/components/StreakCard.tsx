import { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { cn } from '../../../shared/utils/cn';
import { formatStudyDurationSeconds } from '../../../shared/utils/formatStudyDuration';

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
  if (s <= 0) return '—';
  return formatStudyDurationSeconds(s);
}

function getMilestoneMessage(streak: number): string {
  if (streak >= 30) return 'Monthly champion! 🏆';
  if (streak >= 14) return "Two weeks unstoppable! 🔥";
  if (streak >= 7)  return 'One week strong! 💪';
  if (streak >= 3)  return "You're on a roll! 🚀";
  return 'Keep it up!';
}

// ─── Day pill ─────────────────────────────────────────────────────────────────

interface DayPillProps {
  day:     { iso: string; short: string; full: string; isToday: boolean };
  active:  boolean;
  lessons: number;
  seconds: number;
}

function DayPill({ day, active, lessons, seconds }: DayPillProps) {
  const [hovered, setHovered] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);

  const [dotRect, setDotRect] = useState<{ top: number; centerX: number } | null>(null);

  const CARD_W  = 176;
  const GAP     = 8;

  const handleMouseEnter = () => {
    if (dotRef.current) {
      const r = dotRef.current.getBoundingClientRect();
      setDotRect({ top: r.top, centerX: r.left + r.width / 2 });
    }
    setHovered(true);
  };

  const cardLeft = dotRect
    ? Math.min(
        window.innerWidth - CARD_W - 16,
        Math.max(16, dotRect.centerX - CARD_W / 2)
      )
    : 0;

  const arrowLeft = dotRect ? dotRect.centerX - cardLeft : CARD_W / 2;

  const intensity =
    seconds <= 0      ? 0 :
    seconds < 15 * 60 ? 1 :
    seconds < 30 * 60 ? 2 : 3;

  const ringColors = [
    '',
    'ring-2 ring-green-300 dark:ring-green-600',
    'ring-2 ring-green-400 dark:ring-green-500',
    'ring-2 ring-green-500 dark:ring-green-400',
  ];

  return (
    <div
      className="relative flex flex-col items-center gap-1.5"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { setHovered(false); setDotRect(null); }}
    >
      <span className={cn(
        'text-[10px] font-semibold transition-colors',
        day.isToday ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400 dark:text-gray-500'
      )}>
        {day.short}
      </span>

      <div
        ref={dotRef}
        className={cn(
          'w-8 h-8 rounded-full transition-all duration-300 flex items-center justify-center',
          active
            ? 'bg-green-400 dark:bg-green-500 shadow-lg shadow-green-400/30'
            : 'bg-gray-200 dark:bg-gray-700',
          day.isToday && 'ring-2 ring-orange-400 ring-offset-2 dark:ring-offset-gray-800',
          active && !day.isToday && ringColors[intensity],
        )}
      >
        {active && (
          <span className="text-white text-[10px] font-bold">
            {lessons > 0 ? lessons : '✓'}
          </span>
        )}
      </div>

      <AnimatePresence>
        {hovered && dotRect && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{    opacity: 0, y: 2, scale: 0.96 }}
            transition={{ duration: 0.13 }}
            className={cn(
              'fixed z-[9999] w-44 pointer-events-none',
              'bg-[#1e293b] dark:bg-[#0f172a] rounded-xl p-3',
              'shadow-2xl border border-white/10',
            )}
            style={{
              left: cardLeft,
              bottom: `calc(100vh - ${dotRect.top - GAP}px)`,
            }}
          >
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
                <div className="mt-2">
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500"
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

            <div
              className="absolute top-full w-0 h-0"
              style={{
                left: Math.max(8, Math.min(CARD_W - 16, arrowLeft)),
                transform: 'translateX(-50%)',
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

  const flameScale = Math.min(1 + streak.currentStreak * 0.02, 1.5);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
          <span className="text-2xl transition-transform duration-500" style={{ transform: `scale(${flameScale})` }}>
            🔥
          </span>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Your Streak</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{getMilestoneMessage(streak.currentStreak)}</p>
        </div>
      </div>

      {/* Streak stats */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Streak</span>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Complete 2 lessons/day to maintain</p>
          </div>
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

      {/* 7-day activity */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">This week</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">Hover a day for details</p>
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

      {/* Today status */}
      <div className={cn('p-4 rounded-2xl', streak.todayCompleted ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50')}>
        <p className={cn('text-sm font-medium text-center', streak.todayCompleted ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400')}>
          {streak.todayCompleted ? '✅ Today completed!' : '⏳ Complete 2 lessons to count today'}
        </p>
      </div>
    </div>
  );
}