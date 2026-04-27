// src/features/dashboard/components/DeadlinePicker.tsx
// Inline date-picker UI to set or clear a per-document deadline.
//
// The picker panel is rendered in a portal (document.body) and positioned
// fixed relative to the trigger button. This is required because ReadingCard
// wraps the card in overflow-hidden, which clips any absolutely-positioned
// children.

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

  // Used to position the portal panel below the trigger button
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const updatePanelPosition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const panelWidth = 288; // w-72
    const gap = 6;
    const pad = 8;

    let top = rect.bottom + gap;
    let left = rect.left;

    // Prevent overflow off the right edge
    if (left + panelWidth > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - pad - panelWidth);
    }

    setPanelStyle({ position: 'fixed', top, left, width: panelWidth, zIndex: 9999 });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [isOpen, updatePanelPosition]);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    setInputValue(existingDeadline ?? '');
    setError(null);
    setIsOpen(true);
  }

  function handleCancel(e?: React.MouseEvent) {
    e?.stopPropagation();
    setError(null);
    setIsOpen(false);
  }

  async function handleConfirm(e: React.MouseEvent) {
    e.stopPropagation();
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

  const pickerPanel = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — closes picker on outside click */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            aria-hidden
            onClick={(e) => handleCancel(e)}
          />

          {/* Picker panel — rendered above backdrop */}
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={panelStyle}
            className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
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
                onClick={(e) => handleCancel(e)}
                className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-700 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className={cn('relative', className)}>
      {/* ── Trigger row ── */}
      <div className="flex items-center gap-2">
        <button
          ref={triggerRef}
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

      {/* Portal: renders outside the card DOM tree, escaping overflow-hidden */}
      {createPortal(pickerPanel, document.body)}
    </div>
  );
}