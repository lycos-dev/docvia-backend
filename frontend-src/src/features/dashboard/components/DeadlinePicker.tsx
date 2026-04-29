// src/features/dashboard/components/DeadlinePicker.tsx
// Inline date-picker UI to set or clear a per-document deadline.
//
// The picker panel is rendered in a portal (document.body) and positioned
// fixed relative to the trigger button. This avoids clipping inside cards.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Check, ChevronDown, Info, X } from 'lucide-react';
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

function todayTimeDefault(): string {
  return '23:59';
}

function normalizeDisplayDate(value: string | null): string {
  if (!value) return '';
  const safeValue = value.includes('T') ? value : `${value}T12:00:00`;
  return new Date(safeValue).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function parseDeadlineParts(value: string | null): { date: string; toTime: string } {
  if (!value) {
    return { date: todayISO(), toTime: todayTimeDefault() };
  }

  const parsed = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { date: todayISO(), toTime: todayTimeDefault() };
  }

  const date = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return { date, toTime: `${hours}:${minutes}` };
}

function buildDeadlineIso(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

function formatDeadlineTime(value: string | null): string {
  if (!value) return '';
  const safeValue = value.includes('T') ? value : `${value}T12:00:00`;
  return new Date(safeValue).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

const TIME_OPTIONS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00', '22:30',
  '23:00', '23:30', '23:59',
];

let activeDeadlinePickerClose: (() => void) | null = null;

/** Format an ISO date string to a readable label e.g. "May 10, 2025" */
function formatDeadline(isoDate: string): string {
  const parsed = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`);
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
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
  const [editedTitle, setEditedTitle] = useState(doc?.deadlineTitle ?? documentTitle);
  const [deadlineDate, setDeadlineDate] = useState(() => parseDeadlineParts(existingDeadline).date);
  const [toTime, setToTime] = useState(() => parseDeadlineParts(existingDeadline).toTime);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const closePicker = useCallback(() => {
    setError(null);
    setIsOpen(false);
    if (activeDeadlinePickerClose === closePicker) {
      activeDeadlinePickerClose = null;
    }
  }, []);

  const updatePanelPosition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const panelWidth = Math.min(460, window.innerWidth - 16);
    const gap = 6;
    const pad = 8;

    let top = rect.bottom + gap;
    let left = rect.left;

    if (left + panelWidth > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - pad - panelWidth);
    }

    setPanelStyle({ position: 'fixed', top, left, width: panelWidth, zIndex: 9999 });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePanelPosition();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePicker();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [isOpen, updatePanelPosition, closePicker]);

  useEffect(() => {
    if (isOpen) {
      activeDeadlinePickerClose = closePicker;
      return () => {
        if (activeDeadlinePickerClose === closePicker) {
          activeDeadlinePickerClose = null;
        }
      };
    }

    return undefined;
  }, [isOpen, closePicker]);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (activeDeadlinePickerClose && activeDeadlinePickerClose !== closePicker) {
      activeDeadlinePickerClose();
    }
    const parts = parseDeadlineParts(existingDeadline);
    setEditedTitle(doc?.deadlineTitle ?? documentTitle);
    setDeadlineDate(parts.date);
    setToTime(parts.toTime);
    setError(null);
    setIsOpen(true);
  }

  function handleCancel(e?: React.MouseEvent) {
    e?.stopPropagation();
    closePicker();
  }

  async function handleConfirm(e: React.MouseEvent) {
    e.stopPropagation();
    const nextTitle = editedTitle.trim();
    if (!deadlineDate) {
      setError('Please pick a date.');
      return;
    }
    if (!nextTitle) {
      setError('Please enter a title.');
      return;
    }
    if (deadlineDate < todayISO()) {
      setError('Deadline must be today or later.');
      return;
    }

    setDeadline(documentId, buildDeadlineIso(deadlineDate, toTime), nextTitle);
    closePicker();

    // Fire a notification when permission is available — non-blocking
    await requestDeadlineNotification(nextTitle, 3).catch(() => undefined);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    clearDeadline(documentId);
    setEditedTitle(documentTitle);
    setDeadlineDate(todayISO());
    setToTime(todayTimeDefault());
    closePicker();
  }

  const pickerPanel = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Picker panel — rendered above the page, anchored to the trigger */}
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={panelStyle}
            className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Set deadline
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Match the document to a target date and time.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-full p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                aria-label="Close deadline picker"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Deadline Title
                </label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => {
                    setEditedTitle(e.target.value);
                    setError(null);
                  }}
                  className={cn(
                    'w-full rounded-xl border px-4 py-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 transition',
                    error
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-400'
                  )}
                />
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2">
                  <label className="block text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Date
                  </label>
                  <Info size={14} className="text-gray-400" />
                </div>
                <div className="relative">
                  <input
                    type="date"
                    min={todayISO()}
                    value={deadlineDate}
                    onChange={(e) => {
                      setDeadlineDate(e.target.value);
                      setError(null);
                    }}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 pr-11 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 transition',
                      error
                        ? 'border-red-400 focus:ring-red-400'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-400'
                    )}
                  />
                  <CalendarDays
                    size={18}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Time
                </label>
                <div className="relative">
                  <select
                    value={toTime}
                    onChange={(e) => setToTime(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 pr-10 text-sm text-gray-600 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {TIME_OPTIONS.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  />
                </div>
              </div>

              {existingDeadline && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Current deadline: <span className="font-medium text-gray-700 dark:text-gray-200">{normalizeDisplayDate(existingDeadline)} {formatDeadlineTime(existingDeadline)}</span>
                </p>
              )}

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleConfirm}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#89ADE2] px-4 py-3 text-sm font-semibold text-white hover:bg-[#6B93D1] transition-colors cursor-pointer"
              >
                <Check size={13} />
                Save Deadline
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer"
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