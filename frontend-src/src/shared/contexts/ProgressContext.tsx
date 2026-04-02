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
}

interface ProgressContextValue {
  documentProgress: Record<string, DocumentProgress>;
  lessonProgress: Record<string, LessonProgress>;
  streak: StreakData;
  markLessonComplete: (documentId: string, lessonId: string, totalLessons: number) => void;
  setCurrentLesson: (documentId: string, lessonId: string) => void;
  getDocumentProgress: (documentId: string) => DocumentProgress | null;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function computeWeekActivity(dailyCompletions: Record<string, number>): boolean[] {
  const result: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    result.push((dailyCompletions[key] ?? 0) > 0);
  }
  return result;
}

function computeStreak(
  dailyCompletions: Record<string, number>,
  prevStreak: StreakData
): StreakData {
  const today = todayISO();
  const todayCompleted = (dailyCompletions[today] ?? 0) > 0;
  const weekActivity = computeWeekActivity(dailyCompletions);

  let currentStreak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().split('T')[0];
    if ((dailyCompletions[key] ?? 0) > 0) {
      currentStreak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  const longestStreak = Math.max(prevStreak.longestStreak, currentStreak);

  return {
    currentStreak,
    longestStreak,
    lastActiveDate: today,
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
        const percentage = totalLessons > 0
          ? Math.round((completedLessons.length / totalLessons) * 100)
          : 0;

        const docProg: DocumentProgress = {
          documentId,
          completedLessons,
          currentLessonId: existingDoc?.currentLessonId ?? null,
          totalLessons,
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

  const setCurrentLesson = useCallback((documentId: string, lessonId: string) => {
    setStore((prev) => {
      const existing = prev.documentProgress[documentId];
      const docProg: DocumentProgress = {
        documentId,
        completedLessons: existing?.completedLessons ?? [],
        currentLessonId: lessonId,
        totalLessons: existing?.totalLessons ?? 0,
        percentage: existing?.percentage ?? 0,
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
  }, []);

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
