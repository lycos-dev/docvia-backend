/**
 * useTimeTracker
 *
 * Tracks active study time (in whole seconds) for a document+lesson pair.
 * Time only accrues when:
 *   - the browser tab is visible (document.visibilityState === 'visible')
 *   - the window has focus
 *
 * Call it from any page where the user is "studying":
 *   - RoadmapPage  → pass the current lesson id (or null to pause)
 *   - ReaderPage   → pass the open lesson id
 *
 * The hook flushes accumulated seconds to ProgressContext every FLUSH_INTERVAL_MS
 * and also on unmount, so short visits are still captured.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useProgressContext } from '../contexts/ProgressContext';

const TICK_MS         = 1_000;   // granularity: 1 s
const FLUSH_INTERVAL_MS = 10_000; // write to context every 10 s

interface Options {
  /** documentId owning the lesson — pass null/undefined to pause tracking */
  documentId: string | null | undefined;
  /** lessonId being studied — pass null/undefined to pause tracking */
  lessonId:   string | null | undefined;
}

export function useTimeTracker({ documentId, lessonId }: Options): void {
  const { addTimeSpent } = useProgressContext();

  // Accumulated seconds not yet flushed to context
  const pendingRef = useRef(0);
  // Whether we are currently ticking
  const activeRef  = useRef(false);
  // Keep latest flush callback stable
  const flushRef   = useRef<(() => void) | null>(null);

  // Build the flush function and store it in a ref so intervals always call latest
  useEffect(() => {
    flushRef.current = () => {
      if (pendingRef.current > 0 && documentId && lessonId) {
        addTimeSpent(documentId, lessonId, pendingRef.current);
        pendingRef.current = 0;
      }
    };
  });

  const flush = useCallback(() => flushRef.current?.(), []);

  useEffect(() => {
    if (!documentId || !lessonId) return;

    // ── Determine if the timer should tick right now ──────────────────────
    const isVisible = () =>
      typeof document !== 'undefined'
        ? document.visibilityState === 'visible'
        : true;

    const isFocused = () =>
      typeof document !== 'undefined'
        ? document.hasFocus()
        : true;

    const shouldTick = () => isVisible() && isFocused();

    // ── Tick every second ─────────────────────────────────────────────────
    const tickInterval = setInterval(() => {
      if (shouldTick()) {
        pendingRef.current += 1;
        activeRef.current = true;
      }
    }, TICK_MS);

    // ── Flush to context every FLUSH_INTERVAL_MS ──────────────────────────
    const flushInterval = setInterval(() => {
      flush();
    }, FLUSH_INTERVAL_MS);

    // ── Visibility / focus listeners ──────────────────────────────────────
    const handleVisibilityChange = () => {
      if (!isVisible()) flush(); // flush before going hidden
    };

    const handleBlur  = () => flush();
    const handleFocus = () => { /* resume naturally on next tick */ };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur',  handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(tickInterval);
      clearInterval(flushInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur',  handleBlur);
      window.removeEventListener('focus', handleFocus);
      flush(); // final flush on unmount
    };
  }, [documentId, lessonId, flush]);
}