// src/features/roadmap/pages/RoadmapLoadingPage.tsx
import { useState, useEffect } from 'react';
import { X, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../../shared/contexts/ThemeContext';

interface RoadmapLoadingPageProps {
  onClose: () => void;
  apiResolved: boolean;
  onReady: () => void;
  isTimeout?: boolean;
  onRetry?: () => void;
}

const MESSAGES = [
  'Unfolding your learning adventure…',
  'Mapping the road ahead…',
  'AI is charting your path…',
  'Almost ready — big things take a moment…',
  'Turning pages into milestones…',
];

export default function RoadmapLoadingPage({
  onClose,
  apiResolved,
  onReady,
  isTimeout,
  onRetry,
}: RoadmapLoadingPageProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [dashOffset, setDashOffset] = useState(400);
  const [progressWidth, setProgressWidth] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);

  // Trigger road drawing animation after mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setDashOffset(0));
    return () => cancelAnimationFrame(id);
  }, []);

  // Fake progress: 0 → 95 over ~8 seconds (1.2% every 100ms)
  useEffect(() => {
    const interval = setInterval(() => {
      setProgressWidth((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return prev;
        }
        return Math.min(prev + 1.2, 95);
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // When API resolves, jump to 100% then call onReady
  useEffect(() => {
    if (!apiResolved) return;
    setProgressWidth(100);
    const timeout = setTimeout(() => onReady(), 400);
    return () => clearTimeout(timeout);
  }, [apiResolved, onReady]);

  // Cycle messages every 2.5 seconds with fade
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
        setMsgVisible(true);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const pageBg   = isDark ? '#0f172a' : '#F4F4F4';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textMuted = isDark ? '#94A3B8' : '#6B7280';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: pageBg, fontFamily: 'Poppins, sans-serif' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center px-5 py-8 gap-4 relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition hover:scale-105 cursor-pointer"
          style={{ background: pageBg, border: `1px solid ${borderCol}` }}
        >
          <X size={15} style={{ color: textMuted }} />
        </button>

        {/* Skeleton progress bar — absolutely centred */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <div className="w-64 h-2 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>

        <div className="flex-1" />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3 py-2 rounded-xl transition hover:bg-opacity-80 shrink-0 cursor-pointer"
          style={{ background: pageBg, border: `1px solid ${borderCol}` }}
        >
          {isDark
            ? <Sun  size={15} className="text-yellow-400" />
            : <Moon size={15} style={{ color: textMuted }} />}
          <span className="text-[12px] font-medium" style={{ color: textMuted }}>
            {isDark ? 'Dark Mode' : 'Light Mode'}
          </span>
        </button>
      </header>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
        {/* SVG road animation */}
        <svg width="320" height="180" viewBox="0 0 320 180">
          {/* Road background */}
          <path
            d="M 20 160 C 80 160 80 90 160 90 C 240 90 240 20 300 20"
            stroke={isDark ? '#253550' : '#c5d5e8'}
            strokeWidth="20"
            fill="none"
            strokeLinecap="round"
          />
          {/* Animated road line */}
          <path
            d="M 20 160 C 80 160 80 90 160 90 C 240 90 240 20 300 20"
            stroke={isDark ? '#3B82F6' : '#89ADE2'}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="400"
            style={{
              strokeDashoffset: dashOffset,
              transition: 'stroke-dashoffset 3s ease-out',
            }}
          />
          {/* Map emoji */}
          <text
            x="160"
            y="105"
            textAnchor="middle"
            fontSize="28"
            style={{ userSelect: 'none' }}
          >
            🗺️
          </text>
        </svg>

        {/* Cycling message or timeout message */}
        {isTimeout ? (
          <div className="flex flex-col items-center gap-4">
            <p
              className="text-lg font-semibold text-center"
              style={{ color: isDark ? '#F1F5F9' : '#111827' }}
            >
              This is taking a bit longer…
            </p>
            <p
              className="text-sm text-center max-w-xs"
              style={{ color: textMuted }}
            >
              AI lesson generation can take some time. Try again or simplify your document.
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-6 py-3 rounded-2xl font-semibold text-white transition hover:opacity-90 cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}
              >
                Try Again
              </button>
            )}
          </div>
        ) : (
          <p
            className="text-xl font-semibold text-center"
            style={{
              color: isDark ? '#F1F5F9' : '#111827',
              opacity: msgVisible ? 1 : 0,
              transition: 'opacity 0.3s ease',
              minHeight: '2rem',
            }}
          >
            {MESSAGES[msgIndex]}
          </p>
        )}

        {/* Fake progress bar */}
        <div className="w-64 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#3B82F6]"
            style={{
              width: `${progressWidth}%`,
              transition: 'width 100ms linear',
            }}
          />
        </div>
      </div>
    </div>
  );
}
