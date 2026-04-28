import { useMemo, useRef, useState } from 'react';
import { useProgressContext } from "../../../shared/contexts/ProgressContext";
import { useDocuments } from "../../../shared/contexts/DocumentsContext";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { cn } from "../../../shared/utils/cn";
import { Flame, CheckCircle2, Timer } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DeadlineBanner from './DeadlineBanner';

// Ordered by JS getDay(): 0=Sun, 1=Mon, ... 6=Sat
const DAY_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_FULL  = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

function getMilestoneMessage(currentStreak: number): string {
  if (currentStreak >= 30) return "Monthly champion! 🏆";
  if (currentStreak >= 14) return "Two weeks! You're unstoppable! 🔥";
  if (currentStreak >= 7)  return "One week strong! 💪";
  if (currentStreak >= 3)  return "You're on a roll! 🚀";
  return "Keep it up!";
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatDeadlineTime(deadline: string): string {
  const safeValue = deadline.includes('T') ? deadline : `${deadline}T12:00:00`;
  return new Date(safeValue).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function normalizeDeadlineKey(deadline: string): string {
  return deadline.slice(0, 10);
}

function isDeadlineOverdue(deadline: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(`${normalizeDeadlineKey(deadline)}T00:00:00`);
  return deadlineDate.getTime() < today.getTime();
}

interface MonthCalendarCell {
  iso: string;
  dayNumber: number;
  inMonth: boolean;
  isToday: boolean;
  lessons: number;
  seconds: number;
  documents: Array<{ title: string; filename: string; deadlineTitle: string; endTime: string; isOverdue: boolean }>;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function getMonthCalendarCells(
  referenceDate: Date,
  dailyCompletions: Record<string, number>,
  dailyTimeSeconds: Record<string, number>,
  documentsByDate: Map<string, Array<{ title: string; filename: string; deadlineTitle: string; endTime: string; isOverdue: boolean }>>
): MonthCalendarCell[] {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingDays = firstDay.getDay();
  const todayISOValue = localDateISO(new Date());
  const cells: MonthCalendarCell[] = [];

  const totalCells = 42;

  for (let index = 0; index < totalCells; index++) {
    const dayOffset = index - leadingDays;
    const cellDate = new Date(year, month, dayOffset + 1);
    const inMonth = dayOffset >= 0 && dayOffset < daysInMonth;
    const iso = localDateISO(cellDate);

    cells.push({
      iso,
      dayNumber: cellDate.getDate(),
      inMonth,
      isToday: iso === todayISOValue,
      lessons: dailyCompletions[iso] ?? 0,
      seconds: dailyTimeSeconds[iso] ?? 0,
      documents: documentsByDate.get(iso) ?? [],
    });
  }

  return cells;
}

// ─── Tooltip Component ────────────────────────────────────────────────────────

interface TooltipContentProps {
  cardLeft: number;
  arrowLeft: number;
  dotTop: number;
  lessons: number;
  seconds: number;
  cardWidth: number;
  gap: number;
}

function TooltipContent({ cardLeft, arrowLeft, dotTop, lessons, seconds, cardWidth, gap }: TooltipContentProps) {
  const { theme } = useTheme();
  
  const bgColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
  const arrowColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
  const textColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 2, scale: 0.96 }}
      transition={{ duration: 0.13 }}
      className="fixed z-9999 w-40 pointer-events-none rounded-lg p-2.5 shadow-lg"
      style={{
        left: cardLeft,
        bottom: `calc(100vh - ${dotTop - gap}px)`,
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderWidth: '1px',
      }}
    >
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-medium" style={{ color: textColor }}>
            Lessons
          </span>
          <span className="text-[10px] font-semibold text-green-400">
            {lessons}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-medium" style={{ color: textColor }}>
            Hours spent
          </span>
          <span className="text-[10px] font-semibold text-purple-400">
            {formatTime(seconds)}
          </span>
        </div>
      </div>
      <div
        className="absolute top-full w-0 h-0"
        style={{
          left: Math.max(8, Math.min(cardWidth - 16, arrowLeft)),
          transform: 'translateX(-50%)',
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `5px solid ${arrowColor}`,
        }}
      />
    </motion.div>
  );
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
              'fixed z-9999 w-44 pointer-events-none',
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
                      className="h-full rounded-full bg-linear-to-r from-green-400 to-emerald-500"
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

interface MonthCalendarProps {
  dailyCompletions: Record<string, number>;
  dailyTimeSeconds: Record<string, number>;
  documentsByDate: Map<string, Array<{ title: string; filename: string; deadlineTitle: string; endTime: string; isOverdue: boolean }>>;
}

function MonthCalendar({ dailyCompletions, dailyTimeSeconds, documentsByDate }: MonthCalendarProps) {
  const referenceDate = new Date();
  const monthLabel = formatMonthLabel(referenceDate);
  const calendarDays = getMonthCalendarCells(referenceDate, dailyCompletions, dailyTimeSeconds, documentsByDate);

  return (
    <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Month calendar
          </p>
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {monthLabel}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            Active
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            Overdue
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full border border-orange-400" />
            Today
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_SHORT.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day) => (
          <MonthCalendarCellItem key={day.iso} day={day} />
        ))}
      </div>
    </div>
  );
}

interface MonthCalendarCellItemProps {
  day: MonthCalendarCell;
}

function MonthCalendarCellItem({ day }: MonthCalendarCellItemProps) {
  const [hovered, setHovered] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);
  const [cellRect, setCellRect] = useState<{ top: number; centerX: number } | null>(null);

  const deadlineDocument = day.documents[0] ?? null;
  const hasDeadline = Boolean(deadlineDocument);
  const isOverdue = Boolean(deadlineDocument?.isOverdue);
  const hasActivity = day.lessons > 0 || day.seconds > 0 || hasDeadline;

  const handleMouseEnter = () => {
    if (!hasDeadline || !cellRef.current) return;
    const rect = cellRef.current.getBoundingClientRect();
    setCellRect({ top: rect.top, centerX: rect.left + rect.width / 2 });
    setHovered(true);
  };

  const cardWidth = 184;
  const gap = 8;
  const cardLeft = cellRect
    ? Math.min(
        window.innerWidth - cardWidth - 16,
        Math.max(16, cellRect.centerX - cardWidth / 2)
      )
    : 0;
  const arrowLeft = cellRect ? cellRect.centerX - cardLeft : cardWidth / 2;

  return (
    <div
      ref={cellRef}
      className="relative flex items-center justify-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { setHovered(false); setCellRect(null); }}
    >
      <div
        aria-label={`${day.iso}${hasDeadline ? `, ${deadlineDocument.title} due` : ''}`}
        className={cn(
          'aspect-square w-full rounded-xl flex items-center justify-center p-1 text-[11px] font-medium transition-all overflow-hidden',
          day.inMonth
            ? hasActivity
              ? isOverdue
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                : hasDeadline
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
              : 'bg-white text-gray-500 dark:bg-gray-800/70 dark:text-gray-400'
            : 'bg-transparent text-gray-300 dark:text-gray-700',
          day.isToday && 'ring-2 ring-orange-400 ring-offset-1 dark:ring-offset-gray-800',
        )}
      >
        <span className="leading-none">{day.dayNumber}</span>
      </div>

      <AnimatePresence>
        {hovered && cellRect && hasDeadline && deadlineDocument && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 2, scale: 0.96 }}
            transition={{ duration: 0.13 }}
            className="fixed z-9999 w-52 pointer-events-none rounded-lg p-2.5 shadow-lg bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10"
            style={{
              left: cardLeft,
              bottom: `calc(100vh - ${cellRect.top - gap}px)`,
            }}
          >
            <div className="space-y-2">
              {day.documents.map((item) => (
                <div
                  key={item.filename}
                  className="rounded-md bg-gray-50 dark:bg-white/5 px-2 py-1.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">
                      Title
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-semibold text-right truncate',
                        item.isOverdue
                          ? 'text-red-600 dark:text-red-300'
                          : 'text-blue-600 dark:text-blue-300'
                      )}
                    >
                      {item.deadlineTitle}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-3">
                    <span className="text-[9px] font-medium text-gray-500 dark:text-gray-400">
                      End time
                    </span>
                    <span className="text-[10px] font-semibold text-purple-500 dark:text-purple-400">
                      {item.endTime}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div
              className="absolute top-full w-0 h-0"
              style={{
                left: Math.max(8, Math.min(cardWidth - 16, arrowLeft)),
                transform: 'translateX(-50%)',
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid white',
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
  const { streak, dailyCompletions, dailyTimeSeconds, documentProgress } = useProgressContext();
  const { documents } = useDocuments();

  const documentsByDate = useMemo(() => {
    const buckets = new Map<string, Array<{ title: string; filename: string; deadlineTitle: string; endTime: string; isOverdue: boolean }>>();

    documents.forEach((document) => {
      const progress = documentProgress[document.filename];
      const deadline = progress?.deadline;
      if (!deadline) return;

      const key = normalizeDeadlineKey(deadline);
      const existing = buckets.get(key) ?? [];
      existing.push({
        title: document.title,
        filename: document.filename,
        deadlineTitle: progress?.deadlineTitle ?? document.title,
        endTime: formatDeadlineTime(deadline),
        isOverdue: isDeadlineOverdue(deadline),
      });
      buckets.set(key, existing);
    });

    return buckets;
  }, [documents, documentProgress]);

  const flameScale = Math.min(1 + streak.currentStreak * 0.02, 1.5);
  const isStreakBroken = streak.streakJustLost;

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
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Your Streak
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {getMilestoneMessage(streak.currentStreak)}
          </p>
        </div>
      </div>

      {/* Streak stats */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Current Streak
          </span>
          <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {streak.currentStreak} {streak.currentStreak === 1 || streak.currentStreak === 0 ? 'day' : 'days'}
          </span>
        </div>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Longest Streak
          </span>
          <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">
            {streak.longestStreak} {streak.longestStreak === 1 || streak.longestStreak === 0 ? 'day' : 'days'}
          </span>
        </div>
      </div>

      {/* 7-day activity */}
      <div className="mb-5">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          This week
        </p>
        <div className="flex items-center justify-between gap-1">
          {streak.weekActivity.map((active, index) => {
            const isToday = index === 6;
            const today = new Date();
            const dayDate = new Date(today);
            dayDate.setDate(today.getDate() - (6 - index));
            const dateISO = localDateISO(dayDate);
            const lessons = dailyCompletions[dateISO] || 0;
            const seconds = dailyTimeSeconds[dateISO] || 0;
            const [hovered, setHovered] = useState(false);
            const dotRef = useRef<HTMLDivElement>(null);
            const [dotRect, setDotRect] = useState<{ top: number; centerX: number } | null>(null);

            const handleMouseEnter = () => {
              if (dotRef.current) {
                const r = dotRef.current.getBoundingClientRect();
                setDotRect({ top: r.top, centerX: r.left + r.width / 2 });
              }
              setHovered(true);
            };

            const CARD_W = 160;
            const GAP = 8;
            const cardLeft = dotRect
              ? Math.min(
                  window.innerWidth - CARD_W - 16,
                  Math.max(16, dotRect.centerX - CARD_W / 2)
                )
              : 0;
            const arrowLeft = dotRect ? dotRect.centerX - cardLeft : CARD_W / 2;

            return (
              <div key={index} className="relative flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">
                  {DAY_SHORT[index]}
                </span>
                <div
                  ref={dotRef}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={() => { setHovered(false); setDotRect(null); }}
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-300 cursor-pointer",
                    active
                      ? "bg-orange-100 dark:bg-orange-900/30"
                      : "bg-gray-100 dark:bg-gray-800",
                    isToday && "ring-2 ring-orange-400",
                  )}
                >
                  {active ? (
                    <Flame
                      size={14}
                      fill="currentColor"
                      className={cn(
                        isToday
                          ? "text-orange-500 dark:text-orange-400"
                          : "text-orange-300 dark:text-orange-500",
                      )}
                    />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 block" />
                  )}
                </div>
                <AnimatePresence>
                  {hovered && dotRect && active && (
                    <TooltipContent
                      cardLeft={cardLeft}
                      arrowLeft={arrowLeft}
                      dotTop={dotRect.top}
                      lessons={lessons}
                      seconds={seconds}
                      cardWidth={CARD_W}
                      gap={GAP}
                    />
                  )}
                </AnimatePresence>
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
          <button className="w-full py-1.5 px-3 rounded-lg bg-amber-400 dark:bg-amber-500 text-white text-sm font-semibold hover:bg-amber-500 dark:hover:bg-amber-400 transition-colors cursor-pointer">
            Restart Streak
          </button>
        </div>
      ) : (
        <div
          className={cn(
            "p-4 rounded-2xl",
            streak.todayCompleted
              ? "bg-green-50 dark:bg-green-900/20"
              : "bg-gray-50 dark:bg-gray-700/50",
          )}
        >
          <p
            className={cn(
              "text-sm font-medium text-center",
              streak.todayCompleted
                ? "text-green-700 dark:text-green-400"
                : "text-gray-600 dark:text-gray-400",
            )}
          >
            {streak.todayCompleted
              ? "✅ Today completed!"
              : "⏳ Complete today's reading"}
          </p>
        </div>
      )}

      <MonthCalendar
        dailyCompletions={dailyCompletions}
        dailyTimeSeconds={dailyTimeSeconds}
        documentsByDate={documentsByDate}
      />

          {/* Deadline reminders card under the month calendar */}
          <div className="mt-4">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">Deadline reminders</p>
              <div className="flex flex-col gap-2">
                {documents
                  .filter((d) => documentProgress[d.filename]?.deadline != null)
                  .map((d) => (
                    <DeadlineBanner
                      key={`sidebar-deadline-${d.filename}`}
                      documentId={d.filename}
                      documentTitle={d.title}
                    />
                  ))}
              </div>
            </div>
          </div>
    </div>
  );
}