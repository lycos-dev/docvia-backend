import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

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
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  streakStartDate: string | null;
  weekActivity: boolean[];
  todayCompleted: boolean;
}

interface ProgressStore {
  documentProgress: Record<string, DocumentProgress>;
  lessonProgress: Record<string, LessonProgress>;
  streak: StreakData;
  dailyCompletions: Record<string, number>;
  /** YYYY-MM-DD → total seconds studied that day */
  dailyTimeSeconds: Record<string, number>;
}

interface ProgressContextValue {
  documentProgress: Record<string, DocumentProgress>;
  lessonProgress: Record<string, LessonProgress>;
  streak: StreakData;
  markLessonComplete: (documentId: string, lessonId: string, totalLessons: number) => void;
  /** Updates current lesson + last access; pass totalLessons when known so % stays accurate */
  setCurrentLesson: (documentId: string, lessonId: string, totalLessons?: number) => void;
  getDocumentProgress: (documentId: string) => DocumentProgress | null;
  /**
   * Adds seconds to the timeSpentSeconds counter for the given lesson.
   * Called by useTimeTracker — only fires while the user is actively studying
   * (tab visible + window focused) on the Roadmap or Reader pages.
   */
  addTimeSpent: (documentId: string, lessonId: string, seconds: number) => void;
  /** YYYY-MM-DD → seconds studied; used for 7-day activity detail */
  dailyTimeSeconds: Record<string, number>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

function todayISO(): string {
  // Use local date components to avoid UTC offset shifting the date (e.g. Philippines UTC+8)
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localDateISO(d: Date): string {
  // Returns YYYY-MM-DD in the local timezone (fixes UTC offset shifting the date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeWeekActivity(dailyCompletions: Record<string, number>): boolean[] {
  const result: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push((dailyCompletions[localDateISO(d)] ?? 0) >= 2);
  }
  return result;
}

/** Latest calendar day (YYYY-MM-DD) with at least one completion, or null */
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
  const todayCompleted = (dailyCompletions[today] ?? 0) >= 2;
  const weekActivity = computeWeekActivity(dailyCompletions);

  let currentStreak = 0;
  const d = new Date();
  while (true) {
    const key = localDateISO(d); // local date, not UTC
    if ((dailyCompletions[key] ?? 0) >= 2) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  const longestStreak = Math.max(prevStreak.longestStreak, currentStreak);
  const lastActive = lastActiveDayISO(dailyCompletions);

  return {
    currentStreak,
    longestStreak,
    lastActiveDate: lastActive ?? prevStreak.lastActiveDate,
    streakStartDate: prevStreak.streakStartDate,
    weekActivity,
    todayCompleted,
  };
}

const INITIAL_STREAK: StreakData = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
  streakStartDate: null,
  weekActivity: [false, false, false, false, false, false, false],
  todayCompleted: false,
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
    return { ...INITIAL_STORE, ...JSON.parse(raw) };
  } catch {
    return INITIAL_STORE;
  }
}

function saveStore(store: ProgressStore): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<ProgressStore>(loadStore);

  useEffect(() => {
    setStore((prev) => {
      const streak = computeStreak(prev.dailyCompletions, prev.streak);
      const next = { ...prev, streak };
      saveStore(next);
      return next;
    });
  }, []);

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

        const docProg: DocumentProgress = {
          documentId,
          completedLessons,
          currentLessonId: existingDoc?.currentLessonId ?? null,
          totalLessons: mergedTotal,
          percentage,
          startedAt: existingDoc?.startedAt ?? new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          streakDays: existingDoc?.streakDays ?? 0,
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
        const docProg: DocumentProgress = {
          documentId,
          completedLessons: completed,
          currentLessonId: lessonId,
          totalLessons: total,
          percentage,
          startedAt: existing?.startedAt ?? new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          streakDays: existing?.streakDays ?? 0,
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
          isCompleted:      existing?.isCompleted      ?? false,
          completedAt:      existing?.completedAt      ?? null,
          timeSpentSeconds: (existing?.timeSpentSeconds ?? 0) + seconds,
          attempts:         existing?.attempts          ?? 0,
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

  return (
    <ProgressContext.Provider
      value={{
        documentProgress: store.documentProgress,
        lessonProgress: store.lessonProgress,
        streak: store.streak,
        markLessonComplete,
        setCurrentLesson,
        getDocumentProgress,
        addTimeSpent,
        dailyTimeSeconds: store.dailyTimeSeconds ?? {},
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