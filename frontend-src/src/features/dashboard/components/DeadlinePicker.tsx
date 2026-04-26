// src/features/dashboard/components/DeadlinePicker.tsx
// Inline date-picker UI to set or clear a per-document deadline.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Check, X } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { requestDeadlineNotification } from '../../../shared/utils/deadlineNotification';

interface DeadlinePickerProps {
  documentId: string;
  documentTitle: string;
  /** Optional extra class names on the root wrapper */
  className?: string;
}

/** Returns today's date as YYYY-MM-DD (local time) — used as `min` on the input */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Format an ISO date string to a readable label e.g. "May 10, 2025" */
function formatDeadline(isoDate: string): string {
  return new Date(isoDate + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function DeadlinePicker({
  documentId,
  documentTitle,
  className,
}: DeadlinePickerProps) {
  const { documentProgress, setDeadline, clearDeadline } = useProgressContext();
  const doc = documentProgress[documentId];
  const existingDeadline = doc?.deadline ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(existingDeadline ?? '');
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setInputValue(existingDeadline ?? '');
    setError(null);
    setIsOpen(true);
  }

  function handleCancel() {
    setError(null);
    setIsOpen(false);
  }

  async function handleConfirm() {
    if (!inputValue) {
      setError('Please pick a date.');
      return;
    }
    if (inputValue < todayISO()) {
      setError('Deadline must be today or later.');
      return;
    }
    setDeadline(documentId, inputValue);
    setError(null);
    setIsOpen(false);

    // Fire a notification when permission is available — non-blocking
    await requestDeadlineNotification(documentTitle, 3).catch(() => undefined);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    clearDeadline(documentId);
    setInputValue('');
    setIsOpen(false);
  }

  return (
    <div className={cn('relative', className)}>
      {/* ── Trigger row ── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpen}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
            existingDeadline
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          )}
        >
          <CalendarDays size={13} />
          {existingDeadline ? `Finish by ${formatDeadline(existingDeadline)}` : 'Set deadline'}
        </button>

        {existingDeadline && (
          <button
            type="button"
            aria-label="Remove deadline"
            onClick={handleClear}
            className="rounded-full p-0.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── Inline picker panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 z-20 mt-2 w-72 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-xl"
          >
            <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Set finish deadline
            </p>

            <input
              type="date"
              min={todayISO()}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setError(null);
              }}
              className={cn(
                'w-full rounded-xl border px-3 py-2 text-sm text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 transition',
                error
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-gray-300 dark:border-gray-600 focus:ring-blue-400'
              )}
            />

            {error && (
              <p className="mt-1 text-xs text-red-500">{error}</p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleConfirm}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Check size={13} />
                Confirm
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop to close picker on outside click */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10"
          aria-hidden
          onClick={handleCancel}
        />
      )}
    </div>
  );
}