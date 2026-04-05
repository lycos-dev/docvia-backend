// src/features/roadmap/pages/RoadmapLoadingPage.tsx
import { useState, useEffect, useRef } from 'react';
import { X, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../../shared/contexts/ThemeContext';

interface RoadmapLoadingPageProps {
  onClose: () => void;
  apiResolved: boolean;
  onReady: () => void;
  onRetry?: () => void;
}

const MESSAGES = [
  'Mapping the road ahead…',
  'AI is charting your path…',
  'Laying down the milestones…',
  'Almost ready — big things take a moment…',
  'Turning pages into chapters…',
];

const TIMEOUT_MS = 8_000;

// ── Catmull-Rom spline helpers ─────────────────────────────────────────────
function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  );
}
function splinePoint(
  pts: { x: number; y: number }[],
  t: number
): { x: number; y: number } {
  const n = pts.length - 1;
  const seg = Math.min(Math.floor(t * n), n - 1);
  const lt = t * n - seg;
  const i0 = Math.max(seg - 1, 0);
  const i1 = seg;
  const i2 = Math.min(seg + 1, n);
  const i3 = Math.min(seg + 2, n);
  return {
    x: catmull(pts[i0].x, pts[i1].x, pts[i2].x, pts[i3].x, lt),
    y: catmull(pts[i0].y, pts[i1].y, pts[i2].y, pts[i3].y, lt),
  };
}

// ── Road canvas animation ──────────────────────────────────────────────────
function useRoadCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isDark: boolean,
  progressWidth: number
) {
  const frameRef = useRef<number>(0);
  const tRef     = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const col = {
      asphalt:     isDark ? '#1e2a3a' : '#2a3a50',
      roadSurface: isDark ? '#263548' : '#344a64',
      edgeLine:    isDark ? '#60a5fa' : '#3b82f6',
      dashLine:    isDark ? 'rgba(186,230,253,0.65)' : 'rgba(255,255,255,0.65)',
      pinFill:     isDark ? '#3b82f6' : '#2563eb',
      pinStroke:   isDark ? '#93c5fd' : '#60a5fa',
      pinDot:      isDark ? '#eff6ff' : '#ffffff',
      labelText:   isDark ? '#dbeafe' : '#1e3a5f',
      labelBg:     isDark ? 'rgba(15,30,60,0.85)' : 'rgba(239,246,255,0.92)',
      labelBorder: isDark ? 'rgba(96,165,250,0.35)' : 'rgba(37,99,235,0.2)',
      startPin:    isDark ? '#60a5fa' : '#1d4ed8',
      goalPin:     isDark ? '#93c5fd' : '#3b82f6',
      shadow:      'rgba(0,0,0,0.22)',
    };

    const resize = () => {
      const dpr  = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const W = canvas.getBoundingClientRect().width;
    const H = canvas.getBoundingClientRect().height;

    const pts = [
      { x: W * 0.06, y: H * 0.88 },
      { x: W * 0.18, y: H * 0.80 },
      { x: W * 0.28, y: H * 0.68 },
      { x: W * 0.38, y: H * 0.72 },
      { x: W * 0.50, y: H * 0.58 },
      { x: W * 0.60, y: H * 0.44 },
      { x: W * 0.70, y: H * 0.48 },
      { x: W * 0.82, y: H * 0.32 },
      { x: W * 0.94, y: H * 0.16 },
    ];

    const milestones = [
      { t: 0.00, label: 'Start',     color: col.startPin },
      { t: 0.25, label: 'Chapter 1', color: col.pinFill  },
      { t: 0.50, label: 'Chapter 2', color: col.pinFill  },
      { t: 0.75, label: 'Chapter 3', color: col.pinFill  },
      { t: 1.00, label: 'Goal',      color: col.goalPin  },
    ];

    const TOTAL_FRAMES = 180;
    const STEPS        = 200;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const targetFrac = progressWidth / 100;
      const animFrac   = Math.min(tRef.current / TOTAL_FRAMES, 1);
      const prog       = Math.max(Math.min(animFrac, targetFrac + 0.02), 0);

      const tracePath = (offset = { x: 0, y: 0 }, steps = STEPS) => {
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const p = splinePoint(pts, i / STEPS);
          i === 0
            ? ctx.moveTo(p.x + offset.x, p.y + offset.y)
            : ctx.lineTo(p.x + offset.x, p.y + offset.y);
        }
      };

      // Ghost full path
      ctx.save();
      ctx.globalAlpha = 0.10;
      tracePath({ x: 0, y: 0 }, STEPS);
      ctx.strokeStyle = col.asphalt;
      ctx.lineWidth   = 18;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.stroke();
      ctx.restore();

      const revealedSteps = Math.floor(prog * STEPS);
      if (revealedSteps > 0) {
        // Shadow
        ctx.save();
        ctx.globalAlpha = 0.28;
        tracePath({ x: 2, y: 3 }, revealedSteps);
        ctx.strokeStyle = col.shadow;
        ctx.lineWidth   = 22;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();
        ctx.restore();

        // Asphalt body
        tracePath({ x: 0, y: 0 }, revealedSteps);
        ctx.strokeStyle = col.asphalt;
        ctx.lineWidth   = 18;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();

        // Surface band
        tracePath({ x: 0, y: 0 }, revealedSteps);
        ctx.strokeStyle = col.roadSurface;
        ctx.lineWidth   = 11;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.stroke();

        // Blue edge kerb dashes
        tracePath({ x: 0, y: 0 }, revealedSteps);
        ctx.strokeStyle    = col.edgeLine;
        ctx.lineWidth      = 1.5;
        ctx.lineCap        = 'round';
        ctx.lineJoin       = 'round';
        ctx.setLineDash([6, 14]);
        ctx.lineDashOffset = -(tRef.current * 1.5) % 20;
        ctx.stroke();
        ctx.setLineDash([]);

        // White center dashes
        tracePath({ x: 0, y: 0 }, revealedSteps);
        ctx.strokeStyle    = col.dashLine;
        ctx.lineWidth      = 1.2;
        ctx.setLineDash([8, 12]);
        ctx.lineDashOffset = -(tRef.current * 1.5) % 20;
        ctx.stroke();
        ctx.setLineDash([]);

        // Blue ink-tip glow at leading edge
        if (prog < 0.99) {
          const tip   = splinePoint(pts, prog);
          const blink = Math.sin(tRef.current * 0.18) * 0.5 + 0.5;
          ctx.save();
          ctx.globalAlpha = 0.55 + blink * 0.35;
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 6 + blink * 3, 0, Math.PI * 2);
          ctx.fillStyle = col.edgeLine;
          ctx.fill();
          ctx.globalAlpha = 0.20 + blink * 0.20;
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 13 + blink * 4, 0, Math.PI * 2);
          ctx.fillStyle = col.edgeLine;
          ctx.fill();
          ctx.restore();
        }
      }

      // Milestone pins
      milestones.forEach((m) => {
        if (prog < m.t - 0.01) return;
        const fadeIn  = Math.min((prog - m.t + 0.04) / 0.06, 1);
        const p       = splinePoint(pts, m.t);
        const isGoal  = m.t === 1.0;
        const isStart = m.t === 0.0;

        ctx.save();
        ctx.globalAlpha = fadeIn;

        ctx.beginPath();
        ctx.arc(p.x + 1.5, p.y + 2.5, isGoal ? 9 : 7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, isGoal ? 9 : 7, 0, Math.PI * 2);
        ctx.fillStyle   = m.color;
        ctx.fill();
        ctx.strokeStyle = col.pinStroke;
        ctx.lineWidth   = isGoal ? 2 : 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(p.x, p.y, isGoal ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = col.pinDot;
        ctx.fill();

        if (isGoal && prog >= 0.98) {
          const pulse     = Math.sin(tRef.current * 0.1) * 0.5 + 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 13 + pulse * 6, 0, Math.PI * 2);
          ctx.strokeStyle = col.goalPin;
          ctx.lineWidth   = 1;
          ctx.globalAlpha = fadeIn * (0.3 + pulse * 0.4);
          ctx.stroke();
          ctx.globalAlpha = fadeIn;
        }

        ctx.font = `500 10px 'Poppins', sans-serif`;
        const labelW = ctx.measureText(m.label).width + 16;
        const labelH = 18;
        const labelX = isStart ? p.x + 14 : p.x - 14;
        const lx     = isStart ? labelX : labelX - labelW;
        const ly     = p.y - labelH / 2;

        ctx.fillStyle   = col.labelBg;
        ctx.beginPath();
        ctx.roundRect(lx, ly, labelW, labelH, 4);
        ctx.fill();
        ctx.strokeStyle = col.labelBorder;
        ctx.lineWidth   = 0.8;
        ctx.stroke();

        ctx.fillStyle    = col.labelText;
        ctx.textAlign    = (isStart ? 'left' : 'right') as CanvasTextAlign;
        ctx.textBaseline = 'middle';
        ctx.fillText(m.label, isStart ? lx + 8 : lx + labelW - 8, p.y);

        ctx.restore();
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';
      });

      tRef.current += 1;
      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark, progressWidth]);
}

// ── Component ──────────────────────────────────────────────────────────────
export default function RoadmapLoadingPage({
  onClose,
  apiResolved,
  onReady,
  onRetry,
}: RoadmapLoadingPageProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [progressWidth, setProgressWidth] = useState(0);
  const [msgIndex,      setMsgIndex]      = useState(0);
  const [msgVisible,    setMsgVisible]    = useState(true);
  const [timedOut,      setTimedOut]      = useState(false);
  const [retrying,      setRetrying]      = useState(false);
  const [at95,          setAt95]          = useState(false);

  // Stable refs so callbacks never have stale closures
  const apiResolvedRef = useRef(false);
  useEffect(() => {
    if (apiResolved) apiResolvedRef.current = true;
  }, [apiResolved]);

  const retryingRef = useRef(false);
  useEffect(() => { retryingRef.current = retrying; }, [retrying]);

  // ── Phase 1: Fast progress 0 → 95 (~2 s) ───────────────────────────────
  // Re-runs if timedOut is cleared (e.g. "Keep waiting" resets at95).
  useEffect(() => {
    if (timedOut) return;

    const interval = setInterval(() => {
      setProgressWidth((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          setAt95(true);
          return 95;
        }
        return Math.min(prev + 1.9, 95);
      });
    }, 40);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut]);

  // ── Phase 2: 8-second countdown, starts only once we hit 95% ───────────
  useEffect(() => {
    if (!at95) return;

    // API already resolved before we hit 95 — skip straight to 100
    if (apiResolvedRef.current) {
      setProgressWidth(100);
      const id = setTimeout(() => onReady(), 600);
      return () => clearTimeout(id);
    }

    const id = setTimeout(() => {
      if (!apiResolvedRef.current) setTimedOut(true);
    }, TIMEOUT_MS);

    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at95]);

  // ── apiResolved arriving at any point → advance to 100% ────────────────
  useEffect(() => {
    if (!apiResolved) return;

    setTimedOut(false);
    setProgressWidth(100);

    const delay = retryingRef.current ? 2_000 : 600;
    const id = setTimeout(() => onReady(), delay);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiResolved]);

  // ── Retry handler ────────────────────────────────────────────────────────
  const handleRetry = () => {
    setTimedOut(false);
    setAt95(false);
    setProgressWidth(0);
    setRetrying(true);
    retryingRef.current = true;

    if (apiResolvedRef.current) {
      // API already done — don't re-fetch, just wait and proceed
      setProgressWidth(100);
      setTimeout(() => onReady(), 2_000);
      return;
    }

    // API still running — ask parent to restart the fetch
    onRetry?.();
  };

  // ── Automatic retry on timeout ───────────────────────────────────────────
  useEffect(() => {
    if (!timedOut) return;

    // After 3 seconds of timeout, automatically retry
    const retryTimer = setTimeout(() => {
      handleRetry();
    }, 3000);

    return () => clearTimeout(retryTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timedOut]);

  // ── Message cycling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (timedOut) return;
    const interval = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
        setMsgVisible(true);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, [timedOut]);

  useRoadCanvas(canvasRef, isDark, progressWidth);

  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textMuted = isDark ? '#94A3B8' : '#6B7280';
  const textMain  = isDark ? '#F1F5F9' : '#111827';
  const pageBg    = isDark ? '#0f172a' : '#F4F4F4';

  // ── Bottom section ───────────────────────────────────────────────────────
  const renderBottom = () => {
    if (timedOut) {
      return (
        <div className="flex flex-col items-center gap-4">
          <p className="text-lg font-semibold text-center" style={{ color: textMain }}>
            This is taking a bit longer…
          </p>
          <p className="text-sm text-center max-w-xs" style={{ color: textMuted }}>
            AI lesson generation can take some time. Retrying automatically…
          </p>
          <div className="flex gap-2 justify-center">
            <div
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: '#3B82F6', animationDelay: '0ms' }}
            />
            <div
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: '#3B82F6', animationDelay: '150ms' }}
            />
            <div
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: '#3B82F6', animationDelay: '300ms' }}
            />
          </div>
          <button
            onClick={() => { setTimedOut(false); setAt95(false); }}
            className="px-4 py-2 rounded-2xl font-semibold text-sm transition hover:opacity-80 cursor-pointer mt-2"
            style={{
              background:  'transparent',
              border:      `1px solid ${borderCol}`,
              color:       textMuted,
              fontFamily:  'Poppins, sans-serif',
            }}
          >
            Keep waiting or go back
          </button>
        </div>
      );
    }

    if (retrying) {
      return (
        <p className="text-lg font-semibold text-center" style={{ color: textMain }}>
          Re-generating your roadmap…
        </p>
      );
    }

    return (
      <p
        className="text-lg font-semibold text-center"
        style={{
          color:      textMain,
          opacity:    msgVisible ? 1 : 0,
          transition: 'opacity 0.3s ease',
          minHeight:  '2rem',
        }}
      >
        {MESSAGES[msgIndex]}
      </p>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: pageBg, fontFamily: 'Poppins, sans-serif' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center px-5 py-8 gap-4 relative">
        <button
          onClick={onClose}
          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition hover:scale-105 cursor-pointer"
          style={{ background: pageBg, border: `1px solid ${borderCol}` }}
        >
          <X size={15} style={{ color: textMuted }} />
        </button>

        <div className="absolute left-1/2 -translate-x-1/2">
          <div className="w-64 h-2 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse select-none" />
        </div>

        <div className="flex-1" />

        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3 py-2 rounded-xl transition hover:bg-opacity-80 shrink-0 cursor-pointer select-none"
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

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">

        <div className="w-full max-w-lg">
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ height: 260, display: 'block' }}
          />
        </div>

        {renderBottom()}

        {/* Progress bar — hidden on timeout screen */}
        {!timedOut && (
          <>
            <div
              className="w-64 h-[3px] rounded-full overflow-hidden"
              style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width:      `${progressWidth}%`,
                  background: isDark ? '#60a5fa' : '#2563eb',
                  transition: 'width 40ms linear',
                }}
              />
            </div>
            <p
              className="text-[11px] font-medium tabular-nums"
              style={{ color: textMuted, marginTop: -16 }}
            >
              {Math.round(progressWidth)}%
            </p>
          </>
        )}

      </div>
    </div>
  );
}