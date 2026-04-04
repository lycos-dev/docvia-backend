// src/features/reader/components/ReaderToolbar.tsx
import { ChevronLeft, ChevronRight, Sun, Moon, PanelRight, CheckCircle } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

interface ReaderToolbarProps {
  documentTitle: string;
  lessonTitle: string;
  onBack: () => void;
  onPrevLesson: () => void;
  onNextLesson: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onMarkComplete: () => void;
  isCompleted: boolean;
  isPanelOpen: boolean;
  onTogglePanel: () => void;
  isDark: boolean;
  toggleTheme: () => void;
  // New props added for progress tracking
  completedCount: number;
  totalLessons: number;
}

export default function ReaderToolbar({
  documentTitle,
  lessonTitle,
  onBack,
  onPrevLesson,
  onNextLesson,
  hasPrev,
  hasNext,
  onMarkComplete,
  isCompleted,
  isPanelOpen,
  onTogglePanel,
  isDark,
  toggleTheme,
  completedCount,
  totalLessons,
}: ReaderToolbarProps) {
  const pct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-40 h-15 flex items-center px-4 gap-3',
        'bg-white dark:bg-[#1e293b]',
        'border-b border-black/10 dark:border-white/10',
      )}
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className={cn(
          'shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer',
          'text-[#6B7280] dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-white/10',
        )}
        aria-label="Back to roadmap"
      >
        <ChevronLeft size={18} />
        <span className="hidden sm:inline">Back</span>
      </button>

      {/* Breadcrumb */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#111827] dark:text-[#F1F5F9] truncate leading-tight">
          <span className="text-[#6B7280] dark:text-[#94A3B8]">{documentTitle}</span>
          <span className="mx-1.5 text-[#6B7280] dark:text-[#94A3B8]">›</span>
          <span>{lessonTitle}</span>
        </p>
      </div>

      {/* Center Area: Progress Bar */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <div className="flex items-center gap-3 mb-1">
          <div
            className={cn(
              'flex-1 h-2 rounded-full overflow-hidden',
              isDark ? 'bg-white/10' : 'bg-[#E5E7EB]',
            )}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ 
                width: `${pct}%`,
                backgroundColor: isDark ? '#60A5FA' : '#022658' 
              }}
            />
          </div>
          <span
            className="text-sm font-bold tabular-nums shrink-0"
            style={{ color: '#22C55E' }}
          >
            {pct}%
          </span>
        </div>
        <p
          className="text-[11px] font-medium leading-none text-left"
          style={{ color: isDark ? '#94A3B8' : '#022658' }}
        >
          {completedCount}/{totalLessons} lessons completed
        </p>
      </div>

      {/* Right side controls */}
      <div className="shrink-0 flex items-center gap-1.5">
      
        {/* Panel toggle */}
        <button
          onClick={onTogglePanel}
          className={cn(
            'p-1.5 rounded-lg transition-colors cursor-pointer',
            isPanelOpen
              ? 'bg-[#3B82F6]/10 text-[#3B82F6] dark:text-[#60A5FA]'
              : 'text-[#6B7280] dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-white/10',
          )}
          aria-label="Toggle side panel"
        >
          <PanelRight size={18} />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </div>
  );
}
