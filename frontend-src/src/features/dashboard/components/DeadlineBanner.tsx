// src/features/dashboard/components/DeadlineBanner.tsx
// Dismissible in-app reminder banner shown on the Dashboard.
// Only renders when shouldRemind is true (1 or 3 days before deadline).
// Stores dismissal per-day in localStorage — won't re-show until the next trigger day.

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { useDeadlineStatus } from '../../../shared/hooks/useDeadlineStatus';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { requestDeadlineNotification } from '../../../shared/utils/deadlineNotification';

interface DeadlineBannerProps {
  documentId: string;
  documentTitle: string;
  /** Optional extra class names on the banner root */
  className?: string;
}

const DISMISS_KEY_PREFIX = 'docvia-deadline-dismissed';

/** Build a localStorage key scoped to doc + exact trigger day */
function dismissKey(documentId: string, daysLeft: number): string {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return `${DISMISS_KEY_PREFIX}:${documentId}:${daysLeft}:${dateStr}`;
}

function isDismissed(documentId: string, daysLeft: number): boolean {
  try {
    return localStorage.getItem(dismissKey(documentId, daysLeft)) === '1';
  } catch {
    return false;
  }
}

function storeDismissal(documentId: string, daysLeft: number): void {
  try {
    localStorage.setItem(dismissKey(documentId, daysLeft), '1');
  } catch {
    // ignore storage errors (private browsing quota, etc.)
  }
}

export default function DeadlineBanner({
  documentId,
  documentTitle,
  className,
}: DeadlineBannerProps) {
  const { shouldRemind, daysLeft, status } = useDeadlineStatus(documentId);
  const { documentProgress } = useProgressContext();
  const doc = documentProgress[documentId];

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!shouldRemind) return;
    if (isDismissed(documentId, daysLeft)) return;
    setVisible(true);

    // Fire browser notification alongside the banner (non-blocking)
    requestDeadlineNotification(documentTitle, daysLeft).catch(() => undefined);
  }, [shouldRemind, documentId, daysLeft, documentTitle]);

  function handleDismiss() {
    storeDismissal(documentId, daysLeft);
    setVisible(false);
  }

  if (!visible || status === 'none') return null;

  const isUrgent = daysLeft === 1;
  const remaining = (doc?.totalLessons ?? 0) - (doc?.completedLessons.length ?? 0);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={`deadline-banner-${documentId}`}
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={cn(
            'overflow-hidden rounded-2xl border px-4 py-3',
            isUrgent
              ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
              : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20',
            className
          )}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className={cn(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                isUrgent
                  ? 'bg-red-100 dark:bg-red-800/40 text-red-600 dark:text-red-400'
                  : 'bg-yellow-100 dark:bg-yellow-800/40 text-yellow-600 dark:text-yellow-400'
              )}
            >
              <Bell size={14} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm font-semibold leading-snug',
                  isUrgent
                    ? 'text-red-800 dark:text-red-300'
                    : 'text-yellow-800 dark:text-yellow-300'
                )}
              >
                {isUrgent
                  ? `Deadline tomorrow — "${documentTitle}"`
                  : `3 days left — "${documentTitle}"`}
              </p>
              {remaining > 0 && (
                <p
                  className={cn(
                    'mt-0.5 text-xs',
                    isUrgent
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-yellow-700 dark:text-yellow-400'
                  )}
                >
                  {remaining} lesson{remaining !== 1 ? 's' : ''} remaining. Keep it up!
                </p>
              )}
            </div>

            {/* Dismiss */}
            <button
              type="button"
              aria-label="Dismiss reminder"
              onClick={handleDismiss}
              className={cn(
                'mt-0.5 rounded-full p-1 transition-colors cursor-pointer shrink-0',
                isUrgent
                  ? 'text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/30'
                  : 'text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-800/30'
              )}
            >
              <X size={15} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}