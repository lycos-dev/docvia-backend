// src/shared/contexts/ProgressContext.tsx
// DROP-IN REPLACEMENT — adds `deadline`, `dailyTarget`, `setDeadline`, `clearDeadline`
// to DocumentProgress. All existing behaviour is preserved exactly.
// FIX 2: deadline set/clear now syncs to the backend in real-time via the API.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  setDeadline as apiSetDeadline,
  deleteDeadline as apiDeleteDeadline,
  getAllDeadlines,
} from '../services/pdfService';

const STORAGE_KEY = 'docvia-progress';

export interface LessonProgress {
  lessonId: string;
  documentId: string;
  isCompleted: boolean;
  completedAt: string | null;
  timeSpentSeconds: number;
  attempts: number;
}

export interface DocumentProgress {
  documentId: string;
  completedLessons: string[];
  currentLessonId: string | null;
  totalLessons: number;
  percentage: number;
  startedAt: string;
  lastAccessedAt: string;
  streakDays: number;
  // ── NEW ──────────────────────────────────────────────────────────────────
  /** ISO date string (YYYY-MM-DD) for the user-set deadline, or null */
  deadline: string | null;
  /** Lessons per day needed to finish on time (recomputed on every set) */
  dailyTarget: number;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  streakStartDate: string | null;
  weekActivity: boolean[];
  todayCompleted: boolean;
  streakJustLost: boolean;
  /**
   * The ISO date (YYYY-MM-DD) on which the user dismissed the streak-lost
   * warning. Once set, `streakJustLost` will never re-fire for the same loss
   * event — even across page reloads. Reset to `null` when a new streak starts.
   */
  streakLostAcknowledgedDate: string | null;
}

interface ProgressStore {
  documentProgress: Record<string, DocumentProgress>;
  lessonProgress: Record<string, LessonProgress>;
  streak: StreakData;
  dailyCompletions: Record<string, number>;
  dailyTimeSeconds: Record<string, number>;
}

interface ProgressContextValue {
  documentProgress: Record<string, DocumentProgress>;
  lessonProgress: Record<string, LessonProgress>;
  streak: StreakData;
  markLessonComplete: (documentId: string, lessonId: string, totalLessons: number) => void;
  unmarkLessonComplete: (documentId: string, lessonId: string) => void;
  setCurrentLesson: (documentId: string, lessonId: string, totalLessons?: number) => void;
  getDocumentProgress: (documentId: string) => DocumentProgress | null;
  addTimeSpent: (documentId: string, lessonId: string, seconds: number) => void;
  dailyTimeSeconds: Record<string, number>;
  dailyCompletions: Record<string, number>;
  acknowledgeStreakLost: () => void;
  removeDocumentProgress: (documentId: string) => void;
  // ── NEW ──────────────────────────────────────────────────────────────────
  /** Set (or update) a deadline for a document. Recalculates dailyTarget. */
  setDeadline: (documentId: string, isoDate: string) => void;
  /** Remove the deadline for a document, resetting dailyTarget to 0. */
  clearDeadline: (documentId: string) => void;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateISO(d);
}

/**
 * Compute how many lessons/day are needed to finish a document before the deadline.
 * Returns 0 when there's no deadline, the doc is complete, or the deadline has passed.
 */
function computeDailyTarget(
  deadline: string | null,
  completedCount: number,
  totalLessons: number
): number {
  if (!deadline || totalLessons === 0) return 0;
  const remaining = totalLessons - completedCount;
  if (remaining <= 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline + 'T00:00:00');
  const daysLeft = Math.ceil(
    (deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysLeft <= 0) return remaining; // overdue — show full remaining as target
  return Math.ceil(remaining / daysLeft);
}

// ─── Streak helpers (unchanged) ───────────────────────────────────────────────

function computeWeekActivity(dailyCompletions: Record<string, number>): boolean[] {
  const result: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push((dailyCompletions[localDateISO(d)] ?? 0) >= 2);
  }
  return result;
}

function lastActiveDayISO(daily: Record<string, number>): string | null {
  let best: string | null = null;
  for (const [day, count] of Object.entries(daily)) {
    if (count > 0 && (best === null || day > best)) best = day;
  }
  return best;
}

function computeStreak(
  dailyCompletions: Record<string, number>,
  prevStreak: StreakData
): StreakData {
  const today = todayISO();
  const yesterday = yesterdayISO();

  const todayCompleted = (dailyCompletions[today] ?? 0) >= 2;
  const yesterdayCompleted = (dailyCompletions[yesterday] ?? 0) >= 2;
  const weekActivity = computeWeekActivity(dailyCompletions);

  let currentStreak = 0;
  const d = new Date();
  if (!todayCompleted) {
    d.setDate(d.getDate() - 1);
  }
  while (true) {
    const key = localDateISO(d);
    if ((dailyCompletions[key] ?? 0) >= 2) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  const longestStreak = Math.max(prevStreak.longestStreak, currentStreak);
  const lastActive = lastActiveDayISO(dailyCompletions);

  const hadStreak = prevStreak.currentStreak > 0 || prevStreak.longestStreak > 0;
  const gapExists = !yesterdayCompleted && !todayCompleted;

  const alreadyAcknowledged =
    prevStreak.streakLostAcknowledgedDate !== null && currentStreak === 0;

  const streakJustLost =
    hadStreak && gapExists && currentStreak === 0 && !alreadyAcknowledged
      ? true
      : prevStreak.streakJustLost && currentStreak === 0;

  const streakLostAcknowledgedDate =
    currentStreak > 0 ? null : prevStreak.streakLostAcknowledgedDate;

  return {
    currentStreak,
    longestStreak,
    lastActiveDate: lastActive ?? prevStreak.lastActiveDate,
    streakStartDate: prevStreak.streakStartDate,
    weekActivity,
    todayCompleted,
    streakJustLost: streakJustLost ?? false,
    streakLostAcknowledgedDate,
  };
}

// ─── Store init / persistence ─────────────────────────────────────────────────

const INITIAL_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  streakStartDate: null,
  weekActivity: [false, false, false, false, false, false, false],
  todayCompleted: false,
  streakJustLost: false,
  streakLostAcknowledgedDate: null,
};

const INITIAL_STORE: ProgressStore = {
  documentProgress: {},
  lessonProgress: {},
  streak: INITIAL_STREAK,
  dailyCompletions: {},
  dailyTimeSeconds: {},
};

function loadStore(): ProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_STORE;
    const parsed = JSON.parse(raw) as Partial<ProgressStore>;
    if (parsed.streak && parsed.streak.streakJustLost === undefined) {
      parsed.streak.streakJustLost = false;
    }
    if (parsed.streak && parsed.streak.streakLostAcknowledgedDate === undefined) {
      parsed.streak.streakLostAcknowledgedDate = null;
    }
    // Back-fill deadline fields for existing document progress entries
    if (parsed.documentProgress) {
      for (const doc of Object.values(parsed.documentProgress)) {
        if (doc.deadline === undefined) doc.deadline = null;
        if (doc.dailyTarget === undefined) doc.dailyTarget = 0;
      }
    }
    return { ...INITIAL_STORE, ...parsed };
  } catch {
    return INITIAL_STORE;
  }
}

function saveStore(store: ProgressStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<ProgressStore>(loadStore);
  const { token } = useAuth();
  // Keep a ref so callbacks can access the latest token without re-creating
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => {
    setStore((prev) => {
      const streak = computeStreak(prev.dailyCompletions, prev.streak);
      const next = { ...prev, streak };
      saveStore(next);
      return next;
    });
  }, []);

  // ── FIX 2: On login, fetch all deadlines from backend and merge into local store ──
  useEffect(() => {
    if (!token) return;

    getAllDeadlines(token).then((result) => {
      if (!result.success || !result.data) return;

      setStore((prev) => {
        let changed = false;
        const docProgress = { ...prev.documentProgress };

        for (const item of result.data!) {
          const docId = item.pdfId;
          // Extract YYYY-MM-DD from the ISO deadline string
          const isoDate = item.deadline.slice(0, 10);
          const existing = docProgress[docId];

          // Only update if the backend deadline differs from what we have locally
          if (existing?.deadline === isoDate) continue;

          changed = true;
          const completedCount = existing?.completedLessons.length ?? 0;
          const totalLessons = existing?.totalLessons ?? 0;
          const dailyTarget = computeDailyTarget(isoDate, completedCount, totalLessons);

          docProgress[docId] = {
            documentId: docId,
            completedLessons: existing?.completedLessons ?? [],
            currentLessonId: existing?.currentLessonId ?? null,
            totalLessons,
            percentage: existing?.percentage ?? 0,
            startedAt: existing?.startedAt ?? new Date().toISOString(),
            lastAccessedAt: existing?.lastAccessedAt ?? new Date().toISOString(),
            streakDays: existing?.streakDays ?? 0,
            deadline: isoDate,
            dailyTarget,
          };
        }

        if (!changed) return prev;
        const next = { ...prev, documentProgress: docProgress };
        saveStore(next);
        return next;
      });
    }).catch(() => {
      // Silently ignore — local state is used as fallback
    });
  }, [token]);

  // ── Existing actions (unchanged) ───────────────────────────────────────────

  const markLessonComplete = useCallback(
    (documentId: string, lessonId: string, totalLessons: number) => {
      setStore((prev) => {
        const key = `${documentId}:${lessonId}`;
        if (prev.lessonProgress[key]?.isCompleted) return prev;

        const lessonProg: LessonProgress = {
          lessonId,
          documentId,
          isCompleted: true,
          completedAt: new Date().toISOString(),
          timeSpentSeconds: 0,
          attempts: (prev.lessonProgress[key]?.attempts ?? 0) + 1,
        };

        const existingDoc = prev.documentProgress[documentId];
        const completedLessons = Array.from(
          new Set([...(existingDoc?.completedLessons ?? []), lessonId])
        );
        const mergedTotal = Math.max(existingDoc?.totalLessons ?? 0, totalLessons);
        const percentage =
          mergedTotal > 0
            ? Math.min(100, Math.round((completedLessons.length / mergedTotal) * 100))
            : 0;

        // Recompute dailyTarget after completing a lesson
        const deadline = existingDoc?.deadline ?? null;
        const dailyTarget = computeDailyTarget(deadline, completedLessons.length, mergedTotal);

        const docProg: DocumentProgress = {
          documentId,
          completedLessons,
          currentLessonId: existingDoc?.currentLessonId ?? null,
          totalLessons: mergedTotal,
          percentage,
          startedAt: existingDoc?.startedAt ?? new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          streakDays: existingDoc?.streakDays ?? 0,
          deadline,
          dailyTarget,
        };

        const today = todayISO();
        const dailyCompletions = {
          ...prev.dailyCompletions,
          [today]: (prev.dailyCompletions[today] ?? 0) + 1,
        };

        const streak = computeStreak(dailyCompletions, prev.streak);

        const next: ProgressStore = {
          documentProgress: { ...prev.documentProgress, [documentId]: docProg },
          lessonProgress: { ...prev.lessonProgress, [key]: lessonProg },
          streak,
          dailyCompletions,
          dailyTimeSeconds: prev.dailyTimeSeconds,
        };
        saveStore(next);
        return next;
      });
    },
    []
  );

  const unmarkLessonComplete = useCallback(
    (documentId: string, lessonId: string) => {
      setStore((prev) => {
        const key = `${documentId}:${lessonId}`;
        if (!prev.lessonProgress[key]?.isCompleted) return prev;

        const newLessonProgress = { ...prev.lessonProgress };
        delete newLessonProgress[key];

        const existingDoc = prev.documentProgress[documentId];
        if (!existingDoc) return prev;

        const completedLessons = existingDoc.completedLessons.filter((id) => id !== lessonId);
        const percentage =
          existingDoc.totalLessons > 0
            ? Math.min(
                100,
                Math.round((completedLessons.length / existingDoc.totalLessons) * 100)
              )
            : 0;

        const dailyTarget = computeDailyTarget(
          existingDoc.deadline,
          completedLessons.length,
          existingDoc.totalLessons
        );

        const docProg: DocumentProgress = {
          documentId,
          completedLessons,
          currentLessonId: existingDoc.currentLessonId,
          totalLessons: existingDoc.totalLessons,
          percentage,
          startedAt: existingDoc.startedAt,
          lastAccessedAt: new Date().toISOString(),
          streakDays: existingDoc.streakDays,
          deadline: existingDoc.deadline,
          dailyTarget,
        };

        const today = todayISO();
        const dailyCompletions = { ...prev.dailyCompletions };
        if (dailyCompletions[today] > 0) dailyCompletions[today]--;

        const streak = computeStreak(dailyCompletions, prev.streak);

        const next: ProgressStore = {
          documentProgress: { ...prev.documentProgress, [documentId]: docProg },
          lessonProgress: newLessonProgress,
          streak,
          dailyCompletions,
          dailyTimeSeconds: prev.dailyTimeSeconds,
        };
        saveStore(next);
        return next;
      });
    },
    []
  );

  const setCurrentLesson = useCallback(
    (documentId: string, lessonId: string, totalLessonsHint?: number) => {
      setStore((prev) => {
        const existing = prev.documentProgress[documentId];
        const completed = existing?.completedLessons ?? [];
        const total =
          typeof totalLessonsHint === 'number' && totalLessonsHint > 0
            ? totalLessonsHint
            : (existing?.totalLessons ?? 0);
        const percentage =
          total > 0
            ? Math.min(100, Math.round((completed.length / total) * 100))
            : (existing?.percentage ?? 0);

        const deadline = existing?.deadline ?? null;
        const dailyTarget = computeDailyTarget(deadline, completed.length, total);

        const docProg: DocumentProgress = {
          documentId,
          completedLessons: completed,
          currentLessonId: lessonId,
          totalLessons: total,
          percentage,
          startedAt: existing?.startedAt ?? new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          streakDays: existing?.streakDays ?? 0,
          deadline,
          dailyTarget,
        };
        const next = {
          ...prev,
          documentProgress: { ...prev.documentProgress, [documentId]: docProg },
        };
        saveStore(next);
        return next;
      });
    },
    []
  );

  const addTimeSpent = useCallback(
    (documentId: string, lessonId: string, seconds: number) => {
      if (seconds <= 0) return;
      setStore((prev) => {
        const key = `${documentId}:${lessonId}`;
        const existing = prev.lessonProgress[key];
        const lessonProg: LessonProgress = {
          lessonId,
          documentId,
          isCompleted: existing?.isCompleted ?? false,
          completedAt: existing?.completedAt ?? null,
          timeSpentSeconds: (existing?.timeSpentSeconds ?? 0) + seconds,
          attempts: existing?.attempts ?? 0,
        };
        const today = todayISO();
        const dailyTimeSeconds = {
          ...prev.dailyTimeSeconds,
          [today]: (prev.dailyTimeSeconds?.[today] ?? 0) + seconds,
        };
        const next: ProgressStore = {
          ...prev,
          lessonProgress: { ...prev.lessonProgress, [key]: lessonProg },
          dailyTimeSeconds,
        };
        saveStore(next);
        return next;
      });
    },
    []
  );

  const getDocumentProgress = useCallback(
    (documentId: string): DocumentProgress | null =>
      store.documentProgress[documentId] ?? null,
    [store.documentProgress]
  );

  const acknowledgeStreakLost = useCallback(() => {
    setStore((prev) => {
      const next = {
        ...prev,
        streak: {
          ...prev.streak,
          streakJustLost: false,
          streakLostAcknowledgedDate: todayISO(),
        },
      };
      saveStore(next);
      return next;
    });
  }, []);

  const removeDocumentProgress = useCallback((documentId: string) => {
    setStore((prev) => {
      const newDocProgress = { ...prev.documentProgress };
      delete newDocProgress[documentId];
      const next: ProgressStore = { ...prev, documentProgress: newDocProgress };
      saveStore(next);
      return next;
    });
  }, []);

  // ── FIX 2: deadline actions — update local store AND sync to backend ────────

  const setDeadline = useCallback((documentId: string, isoDate: string) => {
    // 1. Update local store immediately (optimistic)
    setStore((prev) => {
      const existing = prev.documentProgress[documentId];
      const completedCount = existing?.completedLessons.length ?? 0;
      const totalLessons = existing?.totalLessons ?? 0;
      const dailyTarget = computeDailyTarget(isoDate, completedCount, totalLessons);

      const docProg: DocumentProgress = {
        documentId,
        completedLessons: existing?.completedLessons ?? [],
        currentLessonId: existing?.currentLessonId ?? null,
        totalLessons,
        percentage: existing?.percentage ?? 0,
        startedAt: existing?.startedAt ?? new Date().toISOString(),
        lastAccessedAt: existing?.lastAccessedAt ?? new Date().toISOString(),
        streakDays: existing?.streakDays ?? 0,
        deadline: isoDate,
        dailyTarget,
      };
      const next: ProgressStore = {
        ...prev,
        documentProgress: { ...prev.documentProgress, [documentId]: docProg },
      };
      saveStore(next);
      return next;
    });

    // 2. Persist to backend — fire-and-forget (errors are silent; local state is the source of truth)
    const currentToken = tokenRef.current;
    if (currentToken) {
      // Backend expects a full ISO datetime string; send end-of-day UTC for the chosen date
      const deadlineISO = `${isoDate}T23:59:59.000Z`;
      apiSetDeadline(documentId, deadlineISO, currentToken).catch((err) => {
        console.warn('[Deadline] Backend sync failed (set):', err);
      });
    }
  }, []);

  const clearDeadline = useCallback((documentId: string) => {
    // 1. Update local store immediately (optimistic)
    setStore((prev) => {
      const existing = prev.documentProgress[documentId];
      if (!existing) return prev;
      const docProg: DocumentProgress = { ...existing, deadline: null, dailyTarget: 0 };
      const next: ProgressStore = {
        ...prev,
        documentProgress: { ...prev.documentProgress, [documentId]: docProg },
      };
      saveStore(next);
      return next;
    });

    // 2. Delete from backend — fire-and-forget
    const currentToken = tokenRef.current;
    if (currentToken) {
      apiDeleteDeadline(documentId, currentToken).catch((err) => {
        console.warn('[Deadline] Backend sync failed (delete):', err);
      });
    }
  }, []);

  // ── Provider value ─────────────────────────────────────────────────────────

  return (
    <ProgressContext.Provider
      value={{
        documentProgress: store.documentProgress,
        lessonProgress: store.lessonProgress,
        streak: store.streak,
        markLessonComplete,
        unmarkLessonComplete,
        setCurrentLesson,
        getDocumentProgress,
        addTimeSpent,
        dailyTimeSeconds: store.dailyTimeSeconds ?? {},
        dailyCompletions: store.dailyCompletions ?? {},
        acknowledgeStreakLost,
        removeDocumentProgress,
        setDeadline,
        clearDeadline,
      }}
    >
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgressContext(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgressContext must be used within ProgressProvider');
  return ctx;
}