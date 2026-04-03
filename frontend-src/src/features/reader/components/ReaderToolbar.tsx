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
}: ReaderToolbarProps) {
  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-4 gap-3',
        'bg-white dark:bg-[#1e293b]',
        'border-b border-black/10 dark:border-white/10',
      )}
      style={{ fontFamily: 'Poppins, sans-serif' }}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        className={cn(
          'shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors',
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

      {/* Right side controls */}
      <div className="shrink-0 flex items-center gap-1.5">
        {/* Prev lesson */}
        <button
          onClick={onPrevLesson}
          disabled={!hasPrev}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            hasPrev
              ? 'text-[#6B7280] dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-white/10'
              : 'text-gray-300 dark:text-white/20 cursor-not-allowed',
          )}
          aria-label="Previous lesson"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Next lesson */}
        <button
          onClick={onNextLesson}
          disabled={!hasNext}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            hasNext
              ? 'text-[#6B7280] dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-white/10'
              : 'text-gray-300 dark:text-white/20 cursor-not-allowed',
          )}
          aria-label="Next lesson"
        >
          <ChevronRight size={18} />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-black/10 dark:bg-white/10 mx-0.5" />

        {/* Mark Complete */}
        {isCompleted ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm font-medium">
            <CheckCircle size={15} />
            <span className="hidden sm:inline">Completed</span>
          </div>
        ) : (
          <button
            onClick={onMarkComplete}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              'bg-[#3B82F6] hover:bg-[#2563EB] text-white',
            )}
          >
            <CheckCircle size={15} />
            <span className="hidden sm:inline">Mark Complete</span>
          </button>
        )}

        {/* Divider */}
        <div className="w-px h-5 bg-black/10 dark:bg-white/10 mx-0.5" />

        {/* Panel toggle */}
        <button
          onClick={onTogglePanel}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
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
          className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </div>
  );
}
