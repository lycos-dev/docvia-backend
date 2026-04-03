import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import RoadmapLoadingPage from './RoadmapLoadingPage';
import { useAuth } from '../../../shared/contexts/AuthContext';
import * as pdfService from '../../../shared/services/pdfService';
import type { BackendLesson } from '../../../shared/services/pdfService';
import {
  X, Moon, Sun, Play, Check,
  ChevronRight, Maximize2,
} from 'lucide-react';
import { useTheme } from '../../../shared/contexts/ThemeContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Lesson {
  id: string;
  title: string;
  isCompleted: boolean;
  isCurrent: boolean;
  durationMin: number;
  isOptional?: boolean;
}
interface Module {
  id: string;
  title: string;
  chapter: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  percentage: number;
  lessonsCompleted: number;
  totalLessons: number;
  lessons: Lesson[];
  pinColor: string;
  pinEmoji: string;
}

// ─── Lesson → Module mapping ─────────────────────────────────────────────────
const PIN_COLORS_LIST = ['#EF4444', '#F97316', '#22C55E', '#3B82F6', '#8B5CF6'];
const PIN_EMOJIS_LIST = ['🎯', '📦', '⚡', '🔍', '🏆'];

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

function mapLessonsToModules(lessons: BackendLesson[], docTitle: string): Module[] {
  return chunkArray(lessons, 5).map((group, idx) => ({
    id: `m${idx + 1}`,
    title: idx === 0 ? docTitle : `Part ${idx + 1}`,
    chapter: idx + 1,
    isCompleted: false,
    isCurrent: idx === 0,
    isLocked: idx > 1,
    percentage: 0,
    lessonsCompleted: 0,
    totalLessons: group.length,
    lessons: group.map((l) => ({
      id: String(l.id),
      title: l.title,
      isCompleted: false,
      isCurrent: false,
      durationMin: 10,
    })),
    pinColor: PIN_COLORS_LIST[idx % PIN_COLORS_LIST.length],
    pinEmoji: PIN_EMOJIS_LIST[idx % PIN_EMOJIS_LIST.length],
  }));
}

// ─── Data ────────────────────────────────────────────────────────────────────
const MODULES: Module[] = [
  {
    id: 'm1', title: 'Testing Fundamentals', chapter: 1,
    isCompleted: true, isCurrent: false, isLocked: false,
    percentage: 100, lessonsCompleted: 3, totalLessons: 3,
    pinColor: '#EF4444', pinEmoji: '🎯',
    lessons: [
      { id: 'l1', title: 'What is Software Testing?', isCompleted: true,  isCurrent: false, durationMin: 12 },
      { id: 'l2', title: 'Why Test?',                  isCompleted: true,  isCurrent: false, durationMin: 8  },
      { id: 'l3', title: 'Testing Lifecycle',          isCompleted: true,  isCurrent: false, durationMin: 15 },
    ],
  },
  {
    id: 'm2', title: 'Black-Box Techniques', chapter: 2,
    isCompleted: true, isCurrent: false, isLocked: false,
    percentage: 100, lessonsCompleted: 2, totalLessons: 2,
    pinColor: '#F97316', pinEmoji: '📦',
    lessons: [
      { id: 'l4', title: 'Boundary Value Analysis',  isCompleted: true, isCurrent: false, durationMin: 18 },
      { id: 'l5', title: 'Equivalence Partitioning', isCompleted: true, isCurrent: false, durationMin: 14 },
    ],
  },
  {
    id: 'm3', title: 'Advanced Techniques', chapter: 3,
    isCompleted: false, isCurrent: true, isLocked: false,
    percentage: 67, lessonsCompleted: 2, totalLessons: 3,
    pinColor: '#22C55E', pinEmoji: '⚡',
    lessons: [
      { id: 'l6', title: 'Decision Table Testing',   isCompleted: true,  isCurrent: false, durationMin: 20 },
      { id: 'l7', title: 'State Transition Testing', isCompleted: true,  isCurrent: false, durationMin: 18 },
      { id: 'l8', title: 'Use Case Testing',         isCompleted: false, isCurrent: true,  durationMin: 22 },
    ],
  },
  {
    id: 'm4', title: 'White-Box Testing', chapter: 4,
    isCompleted: false, isCurrent: false, isLocked: false,
    percentage: 0, lessonsCompleted: 0, totalLessons: 4,
    pinColor: '#3B82F6', pinEmoji: '🔍',
    lessons: [
      { id: 'l9',  title: 'Statement Coverage', isCompleted: false, isCurrent: false, durationMin: 16 },
      { id: 'l10', title: 'Branch Coverage',    isCompleted: false, isCurrent: false, durationMin: 20 },
      { id: 'l11', title: 'Path Coverage',      isCompleted: false, isCurrent: false, durationMin: 22 },
      { id: 'l12', title: 'Condition Coverage', isCompleted: false, isCurrent: false, durationMin: 18, isOptional: true },
    ],
  },
  {
    id: 'm5', title: 'Mastery & Certification', chapter: 5,
    isCompleted: false, isCurrent: false, isLocked: true,
    percentage: 0, lessonsCompleted: 0, totalLessons: 2,
    pinColor: '#8B5CF6', pinEmoji: '🏆',
    lessons: [
      { id: 'l13', title: 'Final Challenge',    isCompleted: false, isCurrent: false, durationMin: 45 },
      { id: 'l14', title: 'Certification Test', isCompleted: false, isCurrent: false, durationMin: 60 },
    ],
  },
];

const DOCUMENT_TITLE  = 'Testing Techniques';
const TOTAL_LESSONS   = 12;
const COMPLETED_COUNT = 5;
const PROGRESS_PCT    = 42;

// ─── SVG Road geometry ───────────────────────────────────────────────────────
// Canvas dimensions
const C_W = 1100;   // viewBox width
const C_H = 340;    // viewBox height

// The road is a smooth sine-wave cubic bezier path spanning full width
// It flows: starts mid-left, rises, falls, rises, falls — 5 inflection points
// One per module
const ROAD_Y_CENTER = 160; // vertical midpoint of the road zone
const WAVE_AMP      = 90;  // how far the wave goes above/below center

// Pre-computed pin positions along the wave — X spaced evenly, Y alternates peak/valley
const PINS: Array<{ x: number; y: number }> = [
  { x: 80,   y: ROAD_Y_CENTER + WAVE_AMP  },   // ch1 — low (left start)
  { x: 300,  y: ROAD_Y_CENTER - WAVE_AMP  },   // ch2 — high
  { x: 550,  y: ROAD_Y_CENTER             },   // ch3 — mid (crossing)
  { x: 790,  y: ROAD_Y_CENTER - WAVE_AMP  },   // ch4 — high
  { x: 1020, y: ROAD_Y_CENTER + WAVE_AMP  },   // ch5 — low (right end)
];

// Build a smooth cubic bezier through the pin points
function buildRoadPath(pins: Array<{ x: number; y: number }>): string {
  if (pins.length < 2) return '';
  let d = `M ${pins[0].x} ${pins[0].y}`;
  for (let i = 1; i < pins.length; i++) {
    const prev = pins[i - 1];
    const curr = pins[i];
    const cpX  = (prev.x + curr.x) / 2;
    d += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

const ROAD_PATH = buildRoadPath(PINS);

// ─── Map-pin SVG component ───────────────────────────────────────────────────
function MapPin({
  x, y, color, emoji, isLocked, isCurrent, chapter,
  onClick,
}: {
  x: number; y: number; color: string; emoji: string;
  isLocked: boolean; isCurrent: boolean; chapter: number;
  onClick: () => void;
}) {
  const pinH = 48;
  const pinR = 22;
  const tipY = y - pinH;      // tip of the teardrop points downward toward road
  const circY = tipY - pinR;  // center of the circle part

  return (
    <g
      onClick={isLocked ? undefined : onClick}
      style={{ cursor: isLocked ? 'default' : 'pointer' }}
    >
      {/* Pulse ring for current */}
      {isCurrent && (
        <circle cx={x} cy={circY} r={pinR + 6}
          fill="none" stroke={color} strokeWidth="2.5" opacity="0.4">
          <animate attributeName="r" values={`${pinR + 4};${pinR + 16};${pinR + 4}`}
            dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5"
            dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Teardrop shadow */}
      <ellipse cx={x + 2} cy={tipY + 4} rx={8} ry={4} fill="rgba(0,0,0,0.25)" />

      {/* Teardrop pin body */}
      <path
        d={`
          M ${x} ${tipY}
          L ${x - pinR * 0.6} ${circY + pinR * 0.5}
          A ${pinR} ${pinR} 0 1 1 ${x + pinR * 0.6} ${circY + pinR * 0.5}
          Z
        `}
        fill={isLocked ? '#6B7280' : color}
        style={{
          filter: isLocked ? 'none' : `drop-shadow(0 4px 12px ${color}80)`,
        }}
      />

      {/* Inner white circle */}
      <circle cx={x} cy={circY} r={pinR - 7}
        fill="rgba(255,255,255,0.92)" />

      {/* Emoji or lock */}
      <text
        x={x} y={circY + 5}
        textAnchor="middle"
        fontSize={isLocked ? 12 : 14}
        style={{ userSelect: 'none' }}
      >
        {isLocked ? '🔒' : emoji}
      </text>

      {/* Chapter number badge (bottom-right of pin) */}
      <circle cx={x + pinR - 4} cy={circY + pinR - 6} r={9}
        fill={isLocked ? '#6B7280' : color} />
      <text
        x={x + pinR - 4} y={circY + pinR - 2}
        textAnchor="middle"
        fontSize="9" fontWeight="700" fill="white"
        fontFamily="Poppins,sans-serif"
        style={{ userSelect: 'none' }}
      >
        {chapter}
      </text>
    </g>
  );
}

// ─── Module Detail Sheet (slide-up panel on click) ───────────────────────────
function ModuleSheet({
  mod, isDark, onClose, onStart,
}: {
  mod: Module; isDark: boolean; onClose: () => void; onStart: (lessonId: string) => void;
}) {
  const surfaceBg = isDark ? '#1e293b' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const textPri   = isDark ? '#F1F5F9' : '#111827';
  const textMuted = isDark ? '#94A3B8' : '#6B7280';
  const subBg     = isDark ? '#0f172a' : '#F8FAFC';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="w-full md:max-w-md mx-0 md:mx-4 rounded-t-3xl md:rounded-3xl p-6"
        style={{
          background: surfaceBg,
          border: `1.5px solid ${mod.isCompleted ? '#22C55E' : mod.isCurrent ? '#3B82F6' : borderCol}`,
          boxShadow: '0 -8px 48px rgba(0,0,0,0.25)',
          animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full mx-auto mb-4 md:hidden"
          style={{ background: isDark ? '#334155' : '#D1D5DB' }} />

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="h-11 w-11 rounded-full flex items-center justify-center shrink-0 text-xl"
            style={{
              background: mod.isLocked ? (isDark ? '#374151' : '#E5E7EB')
                : `${mod.pinColor}22`,
              border: `2px solid ${mod.isLocked ? 'transparent' : mod.pinColor}`,
            }}
          >
            {mod.isLocked ? '🔒' : mod.pinEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: textMuted }}>
              Chapter {mod.chapter}
            </p>
            <h3 className="text-[16px] font-bold truncate" style={{ color: textPri }}>
              {mod.title}
            </h3>
          </div>
          {!mod.isLocked && (
            <span
              className="text-[12px] font-bold px-2.5 py-1 rounded-full shrink-0"
              style={{
                background: mod.isCompleted ? '#16A34A22' : mod.isCurrent ? '#2563EB22' : borderCol,
                color: mod.isCompleted ? '#4ADE80' : mod.isCurrent ? '#60A5FA' : textMuted,
              }}
            >
              {mod.percentage}%
            </span>
          )}
          <button onClick={onClose}
            className="p-1.5 rounded-full shrink-0"
            style={{ color: textMuted }}>
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        {!mod.isLocked && (
          <div className="mb-4">
            <div className="w-full rounded-full overflow-hidden"
              style={{ height: 5, background: isDark ? '#334155' : '#E5E7EB' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${mod.percentage}%`,
                  background: mod.isCompleted
                    ? 'linear-gradient(90deg,#16A34A,#22C55E)'
                    : 'linear-gradient(90deg,#2563EB,#6366F1)',
                }} />
            </div>
          </div>
        )}

        {/* Lessons */}
        {!mod.isLocked ? (
          <div className="space-y-1.5 mb-4">
            {mod.lessons.map(l => (
              <div key={l.id}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                style={{
                  background: l.isCurrent ? (isDark ? '#1e3a5f' : '#EFF6FF') : subBg,
                  border: `1px solid ${l.isCurrent ? (isDark ? '#2563EB50' : '#BFDBFE') : 'transparent'}`,
                }}>
                <div
                  className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: l.isCompleted ? '#16A34A'
                      : l.isCurrent ? '#2563EB'
                      : isDark ? '#334155' : '#E5E7EB',
                  }}
                >
                  {l.isCompleted && <Check size={11} className="text-white" />}
                  {l.isCurrent   && <Play  size={9}  className="text-white" fill="white" />}
                  {!l.isCompleted && !l.isCurrent && (
                    <div className="h-1.5 w-1.5 rounded-full"
                      style={{ background: isDark ? '#475569' : '#9CA3AF' }} />
                  )}
                </div>
                <span className="flex-1 text-[12px]"
                  style={{
                    color: l.isCompleted ? (isDark ? '#4ADE80' : '#16A34A')
                      : l.isCurrent ? (isDark ? '#93C5FD' : '#2563EB')
                      : textMuted,
                    fontWeight: l.isCurrent ? 600 : 400,
                  }}>
                  {l.title}
                  {l.isOptional && (
                    <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full"
                      style={{ background: '#7C3AED22', color: '#7C3AED' }}>
                      optional
                    </span>
                  )}
                </span>
                <span className="text-[10px] shrink-0" style={{ color: isDark ? '#475569' : '#9CA3AF' }}>
                  {l.durationMin}m
                </span>
                {l.isCurrent && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{ background: '#2563EB', color: 'white' }}>
                    NOW
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-4 rounded-xl px-4 py-3 text-center"
            style={{ background: subBg }}>
            <p className="text-[12px]" style={{ color: textMuted }}>
              Complete previous modules to unlock this chapter
            </p>
          </div>
        )}

        {/* CTA */}
        {!mod.isLocked ? (
          <button
            onClick={() => {
              const target = mod.lessons.find(l => l.isCurrent) ?? mod.lessons.find(l => !l.isCompleted) ?? mod.lessons[0];
              if (target) onStart(target.id);
            }}
            className="w-full py-3 rounded-2xl font-semibold text-[13px] text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            style={{
              background: mod.isCompleted
                ? 'linear-gradient(135deg,#16A34A,#15803D)'
                : 'linear-gradient(135deg,#2563EB,#4F46E5)',
            }}
          >
            <Play size={14} fill="white" />
            {mod.isCompleted ? 'Review Chapter' : 'Continue Learning'}
          </button>
        ) : (
          <button disabled
            className="w-full py-3 rounded-2xl font-semibold text-[13px] cursor-not-allowed"
            style={{ background: isDark ? '#1e293b' : '#F3F4F6', color: textMuted }}>
            🔒 Locked
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Vertical roadmap (mobile) ───────────────────────────────────────────────
function MobileRoadmap({ isDark, modules, onStart }: { isDark: boolean; modules: Module[]; onStart: (lessonId: string) => void }) {
  const [selected, setSelected] = useState<Module | null>(null);
  const surfaceBg = isDark ? '#1e293b' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textPri   = isDark ? '#F1F5F9' : '#111827';
  const textMuted = isDark ? '#94A3B8' : '#6B7280';

  return (
    <div className="px-4 py-6">
      {modules.map((mod, i) => (
        <div key={mod.id} className="flex gap-4">
          {/* Left spine */}
          <div className="flex flex-col items-center">
            {/* Pin circle */}
            <button
              onClick={() => !mod.isLocked && setSelected(mod)}
              className="h-11 w-11 rounded-full flex items-center justify-center shrink-0 text-lg transition-transform hover:scale-110"
              style={{
                background: mod.isLocked ? (isDark ? '#334155' : '#E5E7EB') : `${mod.pinColor}22`,
                border: `2.5px solid ${mod.isLocked ? (isDark ? '#475569' : '#9CA3AF') : mod.pinColor}`,
                boxShadow: !mod.isLocked && mod.isCurrent ? `0 0 0 4px ${mod.pinColor}30` : 'none',
              }}
            >
              {mod.isLocked ? '🔒' : mod.pinEmoji}
            </button>
            {/* Connecting line */}
            {i < modules.length - 1 && (
              <div className="w-0.5 flex-1 my-1 rounded-full"
                style={{
                  background: mod.isCompleted
                    ? 'linear-gradient(180deg,#22C55E,#16A34A)'
                    : isDark ? '#334155' : '#E5E7EB',
                  minHeight: 32,
                }} />
            )}
          </div>

          {/* Card */}
          <div className="flex-1 pb-5">
            <button
              onClick={() => !mod.isLocked && setSelected(mod)}
              className="w-full text-left rounded-2xl px-4 py-3 transition-all hover:scale-[1.01]"
              style={{
                background: surfaceBg,
                border: `1.5px solid ${mod.isCurrent ? mod.pinColor : borderCol}`,
                boxShadow: mod.isCurrent
                  ? `0 0 0 3px ${mod.pinColor}15, 0 4px 16px rgba(0,0,0,0.1)`
                  : `0 2px 8px rgba(0,0,0,${isDark ? '0.25' : '0.06'})`,
                opacity: mod.isLocked ? 0.55 : 1,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-semibold" style={{ color: textPri }}>
                  {mod.title}
                </span>
                {mod.isCurrent && <span title="You are here">🚗</span>}
                {mod.isCompleted && (
                  <span className="ml-auto text-[10px] font-bold"
                    style={{ color: '#4ADE80' }}>✓ Done</span>
                )}
              </div>
              <p className="text-[11px]" style={{ color: textMuted }}>
                {mod.isCompleted
                  ? `${mod.totalLessons} lessons completed`
                  : mod.isCurrent
                  ? `${mod.lessonsCompleted} of ${mod.totalLessons} · ${mod.percentage}%`
                  : mod.isLocked
                  ? 'Locked'
                  : `${mod.totalLessons} lessons upcoming`}
              </p>
              {!mod.isLocked && (
                <div className="mt-2 w-full rounded-full overflow-hidden"
                  style={{ height: 3, background: isDark ? '#334155' : '#E5E7EB' }}>
                  <div className="h-full rounded-full"
                    style={{
                      width: `${mod.percentage}%`,
                      background: mod.isCompleted
                        ? 'linear-gradient(90deg,#16A34A,#22C55E)'
                        : 'linear-gradient(90deg,#2563EB,#6366F1)',
                    }} />
                </div>
              )}
            </button>
          </div>
        </div>
      ))}

      {selected && (
        <ModuleSheet mod={selected} isDark={isDark} onClose={() => setSelected(null)} onStart={onStart} />
      )}
    </div>
  );
}

// ─── Horizontal road (desktop) ───────────────────────────────────────────────
function DesktopRoadmap({ isDark, modules, onStart }: { isDark: boolean; modules: Module[]; onStart: (lessonId: string) => void }) {
  const [selected, setSelected] = useState<Module | null>(null);
  const [pan, setPan]       = useState({ x: 0, y: 0 });
  const [zoom, setZoom]     = useState(1);
  const [grabbing, setGrab] = useState(false);
  const wrapRef  = useRef<HTMLDivElement>(null);
  const panRef   = useRef({ dragging: false, sx: 0, sy: 0, px: 0, py: 0 });
  const MIN_Z = 0.4; const MAX_Z = 2.0;

  const surfaceBg = isDark ? '#1e293b' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textMuted = isDark ? '#94A3B8' : '#6B7280';

  // Drag
  const onMD = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    panRef.current = { dragging: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    setGrab(true);
    e.preventDefault();
  }, [pan]);

  useEffect(() => {
    const onMM = (e: MouseEvent) => {
      if (!panRef.current.dragging) return;
      setPan({
        x: panRef.current.px + (e.clientX - panRef.current.sx),
        y: panRef.current.py + (e.clientY - panRef.current.sy),
      });
    };
    const onMU = () => { panRef.current.dragging = false; setGrab(false); };
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup',   onMU);
    return () => { window.removeEventListener('mousemove', onMM); window.removeEventListener('mouseup', onMU); };
  }, []);

  // Wheel zoom
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fn = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.min(MAX_Z, Math.max(MIN_Z, +(z + (e.deltaY < 0 ? 0.08 : -0.08)).toFixed(2))));
    };
    el.addEventListener('wheel', fn, { passive: false });
    return () => el.removeEventListener('wheel', fn);
  }, []);

  // Card info - appears below each pin
  const CARD_INFO_Y = 290; // SVG y where card tops start (below road)

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Canvas */}
      <div
        ref={wrapRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ cursor: grabbing ? 'grabbing' : 'grab' }}
        onMouseDown={onMD}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
        >
          {/* ── SVG Road ─────────────────────────────────────────────── */}
          <svg
            width={C_W}
            height={C_H + 280}
            viewBox={`0 0 ${C_W} ${C_H + 280}`}
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              {/* Road surface gradient — subtle top highlight */}
              <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#3B4F72" />
                <stop offset="40%"  stopColor="#253550" />
                <stop offset="100%" stopColor="#1a2840" />
              </linearGradient>

              {/* Green glow for completed sections */}
              <filter id="greenGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="10" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Road shadow */}
              <filter id="roadShadow" x="-5%" y="-20%" width="110%" height="160%">
                <feDropShadow dx="0" dy="10" stdDeviation="12"
                  floodColor={isDark ? '#00000060' : '#00000030'} />
              </filter>

              {/* Pin glow */}
              <filter id="pinGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              {/* Completed path gradient */}
              <linearGradient id="doneGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#15803D" />
                <stop offset="100%" stopColor="#22C55E" />
              </linearGradient>
            </defs>

            {/* ── Outer glow (completed sections) ─────────────── */}
            <path d={ROAD_PATH} fill="none"
              stroke="#22C55E" strokeWidth="64"
              strokeLinecap="round"
              opacity="0.08"
              filter="url(#greenGlow)"
              strokeDasharray={`${C_W * 0.42} ${C_W}`}
              strokeDashoffset="0"
            />

            {/* ── Road shadow ──────────────────────────────────── */}
            <path d={ROAD_PATH} fill="none"
              stroke="rgba(0,0,0,0.35)" strokeWidth="56"
              strokeLinecap="round"
              transform="translate(0,8)"
              filter="url(#roadShadow)"
            />

            {/* ── Road body ────────────────────────────────────── */}
            {/* Base (darkest edge — gives 3D depth) */}
            <path d={ROAD_PATH} fill="none"
              stroke="#141f30" strokeWidth="58"
              strokeLinecap="round" />

            {/* Main surface */}
            <path d={ROAD_PATH} fill="none"
              stroke="url(#roadGrad)" strokeWidth="50"
              strokeLinecap="round" />

            {/* Completed overlay */}
            <path d={ROAD_PATH} fill="none"
              stroke="url(#doneGrad)" strokeWidth="50"
              strokeLinecap="round"
              opacity="0.65"
              strokeDasharray={`${C_W * 0.42} ${C_W}`}
            />

            {/* Side edge lines (white — lane borders) */}
            <path d={ROAD_PATH} fill="none"
              stroke="rgba(255,255,255,0.18)" strokeWidth="52"
              strokeLinecap="round" />
            <path d={ROAD_PATH} fill="none"
              stroke="url(#roadGrad)" strokeWidth="48"
              strokeLinecap="round" />

            {/* Top surface sheen */}
            <path d={ROAD_PATH} fill="none"
              stroke="rgba(255,255,255,0.07)" strokeWidth="24"
              strokeLinecap="round" />

            {/* Centre dashes */}
            <path d={ROAD_PATH} fill="none"
              stroke="rgba(255,255,255,0.7)" strokeWidth="2.5"
              strokeLinecap="round" strokeDasharray="22 16" />

            {/* ── Vertical connector lines (pin → card) ────────── */}
            {PINS.map((pin, i) => {
              const lineEndY = CARD_INFO_Y - 8;
              if (pin.y >= lineEndY) return null;
              return (
                <line key={`conn-${i}`}
                  x1={pin.x} y1={pin.y - 48}
                  x2={pin.x} y2={lineEndY}
                  stroke={isDark ? '#334155' : '#CBD5E1'}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              );
            })}

            {/* ── Map pins ─────────────────────────────────────── */}
            {modules.map((mod, i) => (
              <MapPin
                key={mod.id}
                x={PINS[i].x}
                y={PINS[i].y}
                color={mod.pinColor}
                emoji={mod.pinEmoji}
                isLocked={mod.isLocked}
                isCurrent={mod.isCurrent}
                chapter={mod.chapter}
                onClick={() => setSelected(mod)}
              />
            ))}

            {/* ── Info cards (rendered as SVG foreignObject) ────── */}
            {modules.map((mod, i) => {
              const cx  = PINS[i].x;
              const cw  = 180;
              const ch  = 86;
              const cx0 = cx - cw / 2;
              const cy0 = CARD_INFO_Y;

              const accentCol = mod.isCompleted ? '#22C55E'
                : mod.isCurrent ? '#3B82F6'
                : isDark ? '#334155' : '#D1D5DB';

              return (
                <g key={`card-${mod.id}`}
                  onClick={() => !mod.isLocked && setSelected(mod)}
                  style={{ cursor: mod.isLocked ? 'default' : 'pointer' }}>

                  {/* Card shadow */}
                  <rect x={cx0 + 3} y={cy0 + 5} width={cw} height={ch} rx="12"
                    fill={isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.06)'} />

                  {/* Card bg */}
                  <rect x={cx0} y={cy0} width={cw} height={ch} rx="12"
                    fill={isDark ? '#1e293b' : '#FFFFFF'}
                    stroke={selected?.id === mod.id ? accentCol : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}
                    strokeWidth={selected?.id === mod.id ? 2 : 1}
                    opacity={mod.isLocked ? 0.5 : 1}
                  />

                  {/* Chapter number circle */}
                  <circle cx={cx0 + 18} cy={cy0 + 18} r={11}
                    fill={mod.isLocked ? (isDark ? '#374151' : '#9CA3AF') : mod.pinColor} />
                  <text x={cx0 + 18} y={cy0 + 22}
                    textAnchor="middle" fontSize="9" fontWeight="700" fill="white"
                    fontFamily="Poppins,sans-serif" style={{ userSelect: 'none' }}>
                    {mod.chapter}
                  </text>

                  {/* Title */}
                  <text x={cx0 + 34} y={cy0 + 15}
                    fontSize="11" fontWeight="700"
                    fill={isDark ? '#F1F5F9' : '#111827'}
                    fontFamily="Poppins,sans-serif"
                    style={{ userSelect: 'none' }}>
                    {mod.title.length > 18 ? mod.title.slice(0, 17) + '…' : mod.title}
                  </text>

                  {/* Subtitle */}
                  <text x={cx0 + 34} y={cy0 + 28}
                    fontSize="9"
                    fill={isDark ? '#94A3B8' : '#6B7280'}
                    fontFamily="Poppins,sans-serif"
                    style={{ userSelect: 'none' }}>
                    {mod.isCompleted
                      ? `✓ ${mod.totalLessons} done`
                      : mod.isCurrent
                      ? `${mod.lessonsCompleted}/${mod.totalLessons} · ${mod.percentage}%`
                      : mod.isLocked
                      ? 'Locked'
                      : `${mod.totalLessons} lessons`}
                  </text>

                  {/* Progress bar */}
                  {!mod.isLocked && (
                    <>
                      <rect x={cx0 + 12} y={cy0 + 38} width={cw - 24} height={3} rx="1.5"
                        fill={isDark ? '#334155' : '#E5E7EB'} />
                      <rect x={cx0 + 12} y={cy0 + 38}
                        width={(cw - 24) * mod.percentage / 100} height={3} rx="1.5"
                        fill={mod.isCompleted ? '#22C55E' : '#3B82F6'} />
                    </>
                  )}

                  {/* Lesson titles (up to 3) */}
                  {mod.lessons.slice(0, 3).map((l, li) => (
                    <text key={l.id}
                      x={cx0 + 12} y={cy0 + 52 + li * 13}
                      fontSize="8.5"
                      fill={l.isCompleted ? '#4ADE80' : l.isCurrent ? '#60A5FA' : (isDark ? '#64748B' : '#9CA3AF')}
                      fontFamily="Poppins,sans-serif"
                      style={{ userSelect: 'none' }}>
                      {l.isCompleted ? '✓ ' : l.isCurrent ? '▶ ' : '• '}
                      {l.title.length > 22 ? l.title.slice(0, 21) + '…' : l.title}
                    </text>
                  ))}
                  {mod.lessons.length > 3 && (
                    <text x={cx0 + 12} y={cy0 + 52 + 3 * 13}
                      fontSize="8" fill={isDark ? '#475569' : '#9CA3AF'}
                      fontFamily="Poppins,sans-serif" style={{ userSelect: 'none' }}>
                      +{mod.lessons.length - 3} more
                    </text>
                  )}

                  {/* Car marker */}
                  {mod.isCurrent && (
                    <text x={cx0 + cw - 20} y={cy0 + 18}
                      textAnchor="middle" fontSize="16"
                      style={{ userSelect: 'none', filter: 'drop-shadow(0 2px 4px rgba(59,130,246,0.5))' }}>
                      🚗
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── Zoom controls ──────────────────────────────────────────────── */}
      <div
        className="absolute bottom-5 right-6 flex items-center rounded-2xl z-20"
        style={{
          background: surfaceBg,
          border: `1px solid ${borderCol}`,
          boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        {[
          { label: '+',   onClick: () => setZoom(z => Math.min(MAX_Z, +(z + 0.15).toFixed(2))), title: 'Zoom in' },
          { label: <Maximize2 size={15} />, onClick: () => { setZoom(1); setPan({ x: 0, y: 0 }); }, title: 'Reset' },
          { label: '−',   onClick: () => setZoom(z => Math.max(MIN_Z, +(z - 0.15).toFixed(2))), title: 'Zoom out' },
        ].map((btn, i, arr) => (
          <div key={i} className="flex items-center">
            <button
              onClick={btn.onClick}
              title={btn.title}
              className="h-11 w-12 flex items-center justify-center transition-colors"
              style={{
                color: textMuted,
                borderRadius: i === 0 ? '14px 0 0 14px' : i === arr.length - 1 ? '0 14px 14px 0' : '0',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = isDark ? '#334155' : '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {typeof btn.label === 'string'
                ? <span className="text-[20px] font-light leading-none">{btn.label}</span>
                : btn.label}
            </button>
            {i < arr.length - 1 && (
              <div style={{ width: 1, height: 22, background: borderCol }} />
            )}
          </div>
        ))}
      </div>

      {/* ── UP NEXT banner ─────────────────────────────────────────────── */}
      {(() => {
        const curMod = modules.find(m => m.isCurrent);
        const curLes = curMod?.lessons.find(l => l.isCurrent);
        if (!curMod || !curLes) return null;
        return (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20"
            style={{ pointerEvents: 'none' }}>
            <div
              className="flex items-center gap-3 rounded-full px-4 py-2.5"
              style={{
                background: isDark ? '#1C1C1E' : '#1F2937',
                boxShadow: '0 6px 28px rgba(0,0,0,0.35)',
                pointerEvents: 'auto',
              }}
            >
              <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: '#EF4444' }}>
                <Play size={13} className="text-white" fill="white" />
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                  Up Next: Learn
                </p>
                <p className="text-[12px] font-bold text-white">{curLes.title}</p>
              </div>
              <ChevronRight size={14} className="text-gray-500" />
            </div>
          </div>
        );
      })()}

      {/* ── Module sheet ───────────────────────────────────────────────── */}
      {selected && (
        <ModuleSheet
          mod={selected} isDark={isDark}
          onClose={() => setSelected(null)} onStart={onStart} />
      )}
    </div>
  );
}

// ─── Root page ────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { documentId } = useParams<{ documentId: string }>();
  const { user } = useAuth();
  const pdfId = documentId ?? null;

  const [modules, setModules] = useState<Module[]>(MODULES);
  const [loadingState, setLoadingState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [apiResolved, setApiResolved] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchLessons = async () => {
      if (!pdfId) {
        // No pdfId — use mock data after a brief simulated delay
        await new Promise<void>((r) => setTimeout(r, 3500));
        if (!cancelled) {
          setApiResolved(true);
          setLoadingState('ready');
        }
        return;
      }
      // Lessons are shared across all accounts — userId left empty until backend scopes them per-user
      let result = await pdfService.getLessons(pdfId, '');
      if (!result.success) {
        result = await pdfService.generateLessons(pdfId, '');
      }
      if (cancelled) return;
      if (result.success && result.data) {
        setModules(mapLessonsToModules(result.data.lessons, result.data.title));
        setApiResolved(true);
        setLoadingState('ready');
      } else {
        setLoadingState('error');
      }
    };
    fetchLessons().catch(() => {
      if (!cancelled) setLoadingState('error');
    });
    return () => { cancelled = true; };
  }, [pdfId, user?.id, retryKey]);

  if (loadingState === 'loading') {
    return (
      <RoadmapLoadingPage
        onClose={() => navigate('/dashboard')}
        apiResolved={apiResolved}
        onReady={() => setLoadingState('ready')}
      />
    );
  }

  if (loadingState === 'error') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: isDark ? '#0f172a' : '#F0F2F5', fontFamily: 'Poppins, sans-serif' }}
      >
        <div className="text-center space-y-4">
          <p className="text-2xl font-semibold" style={{ color: isDark ? '#F1F5F9' : '#111827' }}>
            Oops! Couldn&apos;t load the roadmap.
          </p>
          <p style={{ color: isDark ? '#94A3B8' : '#6B7280' }}>The server might be unavailable.</p>
          <button
            onClick={() => { setLoadingState('loading'); setApiResolved(false); setRetryKey((k) => k + 1); }}
            className="px-6 py-3 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl font-medium transition-colors"
          >
            Retry
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="block mx-auto text-sm underline"
            style={{ color: isDark ? '#94A3B8' : '#6B7280' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const pageBg    = isDark ? '#0f172a' : '#F0F2F5';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textPri   = isDark ? '#F1F5F9' : '#111827';
  const textMuted = isDark ? '#94A3B8' : '#6B7280';

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes modalPop {
          0%   { transform: scale(0.9) translateY(10px); opacity: 0; }
          70%  { transform: scale(1.02);                 opacity: 1; }
          100% { transform: scale(1)   translateY(0); }
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: pageBg, fontFamily: 'Poppins, sans-serif' }}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <header
          className="shrink-0 flex items-center px-5 py-8 gap-4 relative"
        >
          {/* Close */}
          <button
            onClick={() => navigate('/dashboard')}
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition hover:scale-105 cursor-pointer"
            style={{ background: pageBg, border: `1px solid ${borderCol}` }}
          >
            <X size={15} style={{ color: textMuted }} />
          </button>

          {/* Progress pill — absolutely centred */}
          <div className="absolute left-1/2 -translate-x-1/2" style={{ width: 420 }}>
            <div
              className="rounded-2xl px-5 py-2.5"
              style={{
                background: isDark ? '#0f172a' : '#F9FAFB',
                border: `1px solid ${borderCol}`,
                boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[13px] font-semibold" style={{ color: textPri }}>
                  {DOCUMENT_TITLE}
                </span>
                <span className="flex-1" />
                <span className="text-[11px]" style={{ color: textMuted }}>
                  {COMPLETED_COUNT}/{TOTAL_LESSONS} lessons
                </span>
                <span className="text-[14px] font-bold" style={{ color: '#22C55E' }}>
                  {PROGRESS_PCT}%
                </span>
              </div>
              <div className="w-full rounded-full overflow-hidden"
                style={{ height: 5, background: isDark ? '#334155' : '#E5E7EB' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${PROGRESS_PCT}%`,
                    background: 'linear-gradient(90deg,#3B82F6,#6366F1)',
                    transition: 'width 0.8s ease',
                  }}
                />
              </div>
            </div>
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

        {/* ── Desktop: horizontal road (md and above) ───────────────── */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          <DesktopRoadmap isDark={isDark} modules={modules} onStart={(lessonId) => navigate(`/reader/${pdfId ?? 'unknown'}/${lessonId}`)} />
        </div>

        {/* ── Mobile: vertical roadmap (below md) ───────────────────── */}
        <div className="flex md:hidden flex-1 overflow-y-auto">
          <div className="w-full">
            <MobileRoadmap isDark={isDark} modules={modules} onStart={(lessonId) => navigate(`/reader/${pdfId ?? 'unknown'}/${lessonId}`)} />
          </div>
        </div>
      </div>
    </>
  );
}