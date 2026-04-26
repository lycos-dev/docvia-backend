// src/shared/hooks/useDeadlineStatus.ts
// Returns deadline status, days left, daily target, and reminder flag for a document.

import { useMemo } from 'react';
import { useProgressContext } from '../contexts/ProgressContext';

export type DeadlineStatus = 'on-track' | 'behind' | 'overdue' | 'none';

export interface DeadlineStatusResult {
  /** Calendar days remaining until deadline (negative = overdue) */
  daysLeft: number;
  /** Lessons per day the user needs to complete to finish on time */
  dailyTarget: number;
  /** Traffic-light status */
  status: DeadlineStatus;
  /** True when daysLeft is exactly 1 or 3 (reminder trigger days) */
  shouldRemind: boolean;
}

/**
 * Computes how many full-calendar days remain until `isoDate` from today
 * (local time). Returns a negative number if the deadline has passed.
 */
function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(isoDate + 'T00:00:00');
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function useDeadlineStatus(documentId: string): DeadlineStatusResult {
  const { documentProgress } = useProgressContext();
  const doc = documentProgress[documentId];

  return useMemo((): DeadlineStatusResult => {
    const none: DeadlineStatusResult = {
      daysLeft: 0,
      dailyTarget: 0,
      status: 'none',
      shouldRemind: false,
    };

    if (!doc?.deadline) return none;

    const daysLeft = daysUntil(doc.deadline);
    const dailyTarget = doc.dailyTarget;
    const isComplete = doc.percentage >= 100;

    // Overdue: deadline passed and not 100% done
    if (daysLeft < 0 && !isComplete) {
      return { daysLeft, dailyTarget, status: 'overdue', shouldRemind: false };
    }

    // Already finished — no meaningful status
    if (isComplete) {
      return { daysLeft, dailyTarget: 0, status: 'on-track', shouldRemind: false };
    }

    // Determine on-track vs behind.
    // "Behind" = within 3 days of deadline and dailyTarget > 1 (can't keep pace).
    // We consider behind if daysLeft <= 3 and pace needed > 1 lesson/day.
    let status: DeadlineStatus = 'on-track';
    if (daysLeft <= 3 && dailyTarget > 1) {
      status = 'behind';
    }

    const shouldRemind = daysLeft === 1 || daysLeft === 3;

    return { daysLeft, dailyTarget, status, shouldRemind };
  }, [doc]);
}