import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import RoadmapLoadingPage from './RoadmapLoadingPage';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import * as pdfService from '../../../shared/services/pdfService';
import type { BackendLesson } from '../../../shared/services/pdfService';
import { X, Moon, Sun, Play, Check, ChevronRight, Maximize2 } from 'lucide-react';
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
  segment: number;
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

// ─── Lesson → Segment mapping ────────────────────────────────────────────────
const PIN_COLORS_LIST = ['#EF4444', '#F97316', '#22C55E', '#3B82F6', '#8B5CF6'];
const PIN_EMOJIS_LIST = ['🎯', '📦', '⚡', '🔍', '🏆'];

function mapLessonsToModules(
  lessons: BackendLesson[],
  completedLessonIds: string[],
  _docTitle: string
): Module[] {
  const completedSet = new Set(completedLessonIds.map(String));

  return lessons.map((lesson, idx) => {
    const lessonIdStr = String(lesson.id);
    const isCompleted = completedSet.has(lessonIdStr);

    // First incomplete lesson is "current"
    const firstIncompleteIdx = lessons.findIndex(
      (l) => !completedSet.has(String(l.id))
    );
    const isCurrent = idx === (firstIncompleteIdx === -1 ? lessons.length - 1 : firstIncompleteIdx);

    // Locked if more than 1 ahead of last completed
    const lastCompletedIdx = (() => {
      let last = -1;
      lessons.forEach((l, i) => {
        if (completedSet.has(String(l.id))) last = i;
      });
      return last;
    })();
    const isLocked = idx > lastCompletedIdx + 1;

    return {
      id: `m${idx + 1}`,
      title: lesson.title,
      segment: idx + 1,
      isCompleted,
      isCurrent,
      isLocked,
      percentage: isCompleted ? 100 : 0,
      lessonsCompleted: isCompleted ? 1 : 0,
      totalLessons: 1,
      lessons: [{
        id: lessonIdStr,
        title: lesson.title,
        isCompleted,
        isCurrent,
        durationMin: 10,
      }],
      pinColor: PIN_COLORS_LIST[idx % PIN_COLORS_LIST.length],
      pinEmoji: PIN_EMOJIS_LIST[idx % PIN_EMOJIS_LIST.length],
    };
  });
}

// ─── Fallback / Demo Data ─────────────────────────────────────────────────────
const MODULES: Module[] = [
  {
    id: 'm1', title: 'What is Software Testing?', segment: 1,
    isCompleted: true, isCurrent: false, isLocked: false,
    percentage: 100, lessonsCompleted: 1, totalLessons: 1,
    pinColor: '#EF4444', pinEmoji: '🎯',
    lessons: [{ id: 'l1', title: 'What is Software Testing?', isCompleted: true, isCurrent: false, durationMin: 12 }],
  },
  {
    id: 'm2', title: 'Boundary Value Analysis', segment: 2,
    isCompleted: true, isCurrent: false, isLocked: false,
    percentage: 100, lessonsCompleted: 1, totalLessons: 1,
    pinColor: '#F97316', pinEmoji: '📦',
    lessons: [{ id: 'l4', title: 'Boundary Value Analysis', isCompleted: true, isCurrent: false, durationMin: 18 }],
  },
  {
    id: 'm3', title: 'Use Case Testing', segment: 3,
    isCompleted: false, isCurrent: true, isLocked: false,
    percentage: 0, lessonsCompleted: 0, totalLessons: 1,
    pinColor: '#22C55E', pinEmoji: '⚡',
    lessons: [{ id: 'l8', title: 'Use Case Testing', isCompleted: false, isCurrent: true, durationMin: 22 }],
  },
  {
    id: 'm4', title: 'Branch Coverage', segment: 4,
    isCompleted: false, isCurrent: false, isLocked: false,
    percentage: 0, lessonsCompleted: 0, totalLessons: 1,
    pinColor: '#3B82F6', pinEmoji: '🔍',
    lessons: [{ id: 'l10', title: 'Branch Coverage', isCompleted: false, isCurrent: false, durationMin: 20 }],
  },
  {
    id: 'm5', title: 'Certification Test', segment: 5,
    isCompleted: false, isCurrent: false, isLocked: true,
    percentage: 0, lessonsCompleted: 0, totalLessons: 1,
    pinColor: '#8B5CF6', pinEmoji: '🏆',
    lessons: [{ id: 'l14', title: 'Certification Test', isCompleted: false, isCurrent: false, durationMin: 60 }],
  },
];

// ─── SVG Road geometry ────────────────────────────────────────────────────────
const C_H = 340;
const ROAD_Y_CENTER = 160;
const WAVE_AMP = 90;
const PIN_SPACING = 235;
const MARGIN_X = 80;

const Y_WAVE = [
  ROAD_Y_CENTER + WAVE_AMP,
  ROAD_Y_CENTER - WAVE_AMP,
  ROAD_Y_CENTER,
  ROAD_Y_CENTER - WAVE_AMP,
];

function buildPins(count: number): Array<{ x: number; y: number }> {
  return Array.from({ length: count }, (_, i) => ({
    x: MARGIN_X + i * PIN_SPACING,
    y: Y_WAVE[i % Y_WAVE.length],
  }));
}

function svgCanvasWidth(count: number): number {
  return MARGIN_X + Math.max(0, count - 1) * PIN_SPACING + MARGIN_X;
}

function buildRoadPath(pins: Array<{ x: number; y: number }>): string {
  if (pins.length < 2) return '';
  let d = `M ${pins[0].x} ${pins[0].y}`;
  for (let i = 1; i < pins.length; i++) {
    const prev = pins[i - 1];
    const curr = pins[i];
    const cpX = (prev.x + curr.x) / 2;
    d += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

// ─── Number Node SVG (image 1 style: circle with number) ────────────────────
function NumberNode({
  x, y, segment, isCompleted, isCurrent, isLocked, isFinal, color, onClick,
}: {
  x: number; y: number; segment: number; isCompleted: boolean;
  isCurrent: boolean; isLocked: boolean; isFinal: boolean; color: string;
  onClick: () => void;
}) {
  const r = 24;
  const nodeY = y - 60; // sit above the road

  const bgColor = isCompleted ? '#22C55E' : isLocked ? '#9CA3AF' : isCurrent ? color : '#E5E7EB';
  const textColor = (isCompleted || isCurrent || isLocked) ? '#fff' : '#374151';
  const strokeColor = isCurrent ? color : isCompleted ? '#16A34A' : '#D1D5DB';

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* Pulse for current */}
      {isCurrent && (
        <circle cx={x} cy={nodeY} r={r + 8} fill={color} opacity="0.2">
          <animate attributeName="r" values={`${r + 4};${r + 16};${r + 4}`} dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Shadow */}
      <circle cx={x + 2} cy={nodeY + 3} r={r} fill="rgba(0,0,0,0.15)" />

      {/* Main circle */}
      <circle cx={x} cy={nodeY} r={r} fill={bgColor} stroke={strokeColor} strokeWidth="2.5" />

      {/* Car emoji on current */}
      {isCurrent && (
        <text x={x} y={nodeY - r - 10} textAnchor="middle" fontSize="20" style={{ userSelect: 'none' }}>🚗</text>
      )}

      {/* Final destination icon */}
      {isFinal && !isCurrent && (
        <text x={x} y={nodeY - r - 10} textAnchor="middle" fontSize="18" style={{ userSelect: 'none' }}>🏫</text>
      )}

      {/* Content: checkmark, lock, or number */}
      {isCompleted ? (
        <text x={x} y={nodeY + 5} textAnchor="middle" fontSize="16" fill="#fff" fontWeight="700" style={{ userSelect: 'none' }}>✓</text>
      ) : isLocked ? (
        <text x={x} y={nodeY + 5} textAnchor="middle" fontSize="14" fill="#fff" style={{ userSelect: 'none' }}>🔒</text>
      ) : (
        <text x={x} y={nodeY + 5} textAnchor="middle" fontSize="14" fill={textColor} fontWeight="700" fontFamily="Poppins,sans-serif" style={{ userSelect: 'none' }}>
          {segment}
        </text>
      )}

      {/* Connector line from node to road */}
      <line x1={x} y1={nodeY + r} x2={x} y2={y - 4} stroke={isCompleted ? '#22C55E' : '#CBD5E1'} strokeWidth="2" strokeDasharray="4 3" />
    </g>
  );
}

// ─── Lesson title label below pin ────────────────────────────────────────────
function LessonLabel({
  x, y, title, isCompleted, isCurrent, isLocked, isDark,
}: {
  x: number; y: number; title: string; isCompleted: boolean;
  isCurrent: boolean; isLocked: boolean; isDark: boolean;
}) {
  const CARD_Y = y + 20;
  const cw = 180;
  const cx0 = x - cw / 2;
  const labelColor = isCompleted ? '#16A34A' : isCurrent ? '#2563EB' : isLocked ? '#9CA3AF' : (isDark ? '#94A3B8' : '#6B7280');
  const bgFill = isDark ? '#1e293b' : '#FFFFFF';
  const border = isCurrent ? '#3B82F6' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)');

  const truncated = title.length > 22 ? title.slice(0, 21) + '…' : title;

  return (
    <g>
      <rect x={cx0} y={CARD_Y} width={cw} height={40} rx="10"
        fill={bgFill} stroke={border} strokeWidth="1.5" opacity={isLocked ? 0.6 : 1} />
      <text x={x} y={CARD_Y + 16} textAnchor="middle" fontSize="11" fontWeight={isCurrent ? '700' : '500'}
        fill={labelColor} fontFamily="Poppins,sans-serif" style={{ userSelect: 'none' }}>
        {truncated}
      </text>
      {isCompleted && (
        <text x={x} y={CARD_Y + 30} textAnchor="middle" fontSize="9" fill="#16A34A" fontFamily="Poppins,sans-serif" style={{ userSelect: 'none' }}>
          ✓ Completed
        </text>
      )}
      {isCurrent && !isCompleted && (
        <text x={x} y={CARD_Y + 30} textAnchor="middle" fontSize="9" fill="#2563EB" fontFamily="Poppins,sans-serif" style={{ userSelect: 'none' }}>
          ▶ In Progress
        </text>
      )}
      {isLocked && (
        <text x={x} y={CARD_Y + 30} textAnchor="middle" fontSize="9" fill="#9CA3AF" fontFamily="Poppins,sans-serif" style={{ userSelect: 'none' }}>
          Locked
        </text>
      )}
    </g>
  );
}

// ─── Lesson Modal (image 1 style: simple with Continue button) ───────────────
function LessonModal({
  mod, isDark, onClose, onStart, onSkip, totalCompleted, total,
}: {
  mod: Module; isDark: boolean; onClose: () => void;
  onStart: (lessonId: string) => void; onSkip: (lessonId: string) => void;
  totalCompleted: number; total: number;
}) {
  const surfaceBg = isDark ? '#1e293b' : '#FFFFFF';
  const textPri = isDark ? '#F1F5F9' : '#111827';
  const textMuted = isDark ? '#94A3B8' : '#6B7280';

  const lesson = mod.lessons[0];
  const progressPct = total > 0 ? Math.round((totalCompleted / total) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: surfaceBg,
          borderRadius: 20,
          padding: '24px',
          width: 360,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          animation: 'modalPop 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
          position: 'relative',
        }}
      >
        {/* Close X */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 18, color: textMuted, lineHeight: 1,
          }}
        >×</button>

        {/* Progress ring + segment info (image 1 style) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          {/* Circular progress */}
          <div style={{ position: 'relative', width: 60, height: 60, flexShrink: 0 }}>
            <svg width="60" height="60" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="24" fill="none" stroke={isDark ? '#334155' : '#E5E7EB'} strokeWidth="5" />
              <circle
                cx="30" cy="30" r="24"
                fill="none"
                stroke={mod.isCompleted ? '#22C55E' : mod.isCurrent ? '#F97316' : '#9CA3AF'}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - progressPct / 100)}`}
                transform="rotate(-90 30 30)"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
              <text x="30" y="35" textAnchor="middle" fontSize="13" fontWeight="700"
                fill={isDark ? '#F1F5F9' : '#111827'} fontFamily="Poppins,sans-serif">
                {progressPct}
              </text>
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 11, color: textMuted, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Segment {mod.segment}
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, color: textPri, margin: 0, lineHeight: 1.3 }}>
              {mod.title}
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {mod.isCompleted && (
            <span style={{
              background: '#DCFCE7', color: '#16A34A', borderRadius: 20,
              padding: '3px 10px', fontSize: 11, fontWeight: 600,
            }}>✓ Completed</span>
          )}
          {mod.isLocked && (
            <span style={{
              background: isDark ? '#374151' : '#F3F4F6', color: textMuted,
              borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
            }}>🔒 Locked</span>
          )}
          {mod.isCurrent && !mod.isCompleted && (
            <span style={{
              background: '#DBEAFE', color: '#2563EB',
              borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
            }}>▶ In Progress</span>
          )}
        </div>

        {/* Locked notice with Skip option */}
        {mod.isLocked && (
          <div style={{
            background: isDark ? '#1e3a5f' : '#FEF9C3',
            border: `1px solid ${isDark ? '#2563EB40' : '#FDE047'}`,
            borderRadius: 12, padding: '10px 14px', marginBottom: 16,
          }}>
            <p style={{ fontSize: 12, color: isDark ? '#93C5FD' : '#92400E', margin: '0 0 6px' }}>
              🔒 This segment is locked. Complete previous segments first.
            </p>
            <button
              onClick={() => lesson && onSkip(lesson.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: isDark ? '#60A5FA' : '#2563EB',
                fontWeight: 600, padding: 0, textDecoration: 'underline',
              }}
            >
              Skip lock and access anyway →
            </button>
          </div>
        )}

        {/* Continue / Start button (image 1 style: blue pill with play icon) */}
        {!mod.isLocked && (
          <button
            onClick={() => lesson && onStart(lesson.id)}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #4F8EF7, #3B82F6)',
              border: 'none',
              borderRadius: 50,
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(59,130,246,0.4)',
            }}
          >
            {/* Play icon circle */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Play size={14} fill="white" className="text-white" style={{ marginLeft: 2 }} />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'Poppins,sans-serif' }}>
              {mod.isCompleted ? 'Review Lesson' : 'Continue'}
            </span>
          </button>
        )}

        {/* Locked but skip option - still show CTA */}
        {mod.isLocked && (
          <button
            onClick={() => lesson && onSkip(lesson.id)}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #4F8EF7, #3B82F6)',
              border: 'none',
              borderRadius: 50,
              padding: '14px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(59,130,246,0.3)',
              opacity: 0.85,
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Play size={14} fill="white" className="text-white" style={{ marginLeft: 2 }} />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'Poppins,sans-serif' }}>
              Skip &amp; Continue
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Mobile Roadmap ───────────────────────────────────────────────────────────
function MobileRoadmap({
  isDark, modules, onStart, onSkip, totalCompleted,
}: {
  isDark: boolean; modules: Module[];
  onStart: (lessonId: string) => void; onSkip: (lessonId: string) => void;
  totalCompleted: number;
}) {
  const [selected, setSelected] = useState<Module | null>(null);
  const surfaceBg = isDark ? '#1e293b' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textPri = isDark ? '#F1F5F9' : '#111827';
  const textMuted = isDark ? '#94A3B8' : '#6B7280';

  return (
    <div className="px-4 py-6">
      {modules.map((mod, i) => (
        <div key={mod.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <button
              onClick={() => setSelected(mod)}
              className="h-11 w-11 rounded-full flex items-center justify-center shrink-0 text-lg transition-transform hover:scale-110 relative"
              style={{
                background: mod.isCompleted ? '#22C55E' : mod.isCurrent ? mod.pinColor : mod.isLocked ? (isDark ? '#334155' : '#E5E7EB') : (isDark ? '#1e293b' : '#F9FAFB'),
                border: `2.5px solid ${mod.isCompleted ? '#16A34A' : mod.isCurrent ? mod.pinColor : (isDark ? '#475569' : '#D1D5DB')}`,
                boxShadow: !mod.isLocked && mod.isCurrent ? `0 0 0 4px ${mod.pinColor}30` : 'none',
                color: (mod.isCompleted || mod.isCurrent) ? '#fff' : (isDark ? '#94A3B8' : '#6B7280'),
                fontSize: 13, fontWeight: 700, fontFamily: 'Poppins,sans-serif',
              }}
            >
              {mod.isCompleted ? '✓' : mod.isLocked ? '🔒' : mod.segment}
              {mod.isCurrent && (
                <span style={{ position: 'absolute', top: -16, fontSize: 14 }}>🚗</span>
              )}
              {i === modules.length - 1 && !mod.isCurrent && (
                <span style={{ position: 'absolute', top: -16, fontSize: 14 }}>🏫</span>
              )}
            </button>
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

          <div className="flex-1 pb-5">
            <button
              onClick={() => setSelected(mod)}
              className="w-full text-left rounded-2xl px-4 py-3 transition-all hover:scale-[1.01]"
              style={{
                background: surfaceBg,
                border: `1.5px solid ${mod.isCurrent ? mod.pinColor : borderCol}`,
                boxShadow: mod.isCurrent
                  ? `0 0 0 3px ${mod.pinColor}15, 0 4px 16px rgba(0,0,0,0.1)`
                  : `0 2px 8px rgba(0,0,0,${isDark ? '0.25' : '0.06'})`,
                opacity: mod.isLocked ? 0.7 : 1,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[13px] font-semibold" style={{ color: textPri }}>{mod.title}</span>
                {mod.isCurrent && <span title="You are here">🚗</span>}
                {mod.isCompleted && <span className="ml-auto text-[10px] font-bold" style={{ color: '#4ADE80' }}>✓ Done</span>}
              </div>
              <p className="text-[11px]" style={{ color: textMuted }}>
                {mod.isCompleted ? 'Completed' : mod.isCurrent ? 'In Progress' : mod.isLocked ? 'Locked' : 'Not started'}
              </p>
            </button>
          </div>
        </div>
      ))}

      {selected && (
        <LessonModal
          mod={selected} isDark={isDark}
          onClose={() => setSelected(null)}
          onStart={(lid) => { setSelected(null); onStart(lid); }}
          onSkip={(lid) => { setSelected(null); onSkip(lid); }}
          totalCompleted={totalCompleted}
          total={modules.length}
        />
      )}
    </div>
  );
}

// ─── Desktop Roadmap ──────────────────────────────────────────────────────────
function DesktopRoadmap({
  isDark, modules, onStart, onSkip, totalCompleted,
}: {
  isDark: boolean; modules: Module[];
  onStart: (lessonId: string) => void; onSkip: (lessonId: string) => void;
  totalCompleted: number;
}) {
  const [selected, setSelected] = useState<Module | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [grabbing, setGrab] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ dragging: false, sx: 0, sy: 0, px: 0, py: 0 });
  const MIN_Z = 0.4; const MAX_Z = 2.0;

  const surfaceBg = isDark ? '#1e293b' : '#FFFFFF';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textMuted = isDark ? '#94A3B8' : '#6B7280';

  const onMD = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    panRef.current = { dragging: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    setGrab(true);
    e.preventDefault();
  }, [pan]);

  useEffect(() => {
    const onMM = (e: MouseEvent) => {
      if (!panRef.current.dragging) return;
      setPan({ x: panRef.current.px + (e.clientX - panRef.current.sx), y: panRef.current.py + (e.clientY - panRef.current.sy) });
    };
    const onMU = () => { panRef.current.dragging = false; setGrab(false); };
    window.addEventListener('mousemove', onMM);
    window.addEventListener('mouseup', onMU);
    return () => { window.removeEventListener('mousemove', onMM); window.removeEventListener('mouseup', onMU); };
  }, []);

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

  const pins = buildPins(modules.length);
  const cW = svgCanvasWidth(modules.length);
  const roadPath = buildRoadPath(pins);

  // Current lesson for "UP NEXT" banner
  const curMod = modules.find(m => m.isCurrent) ?? modules.find(m => !m.isCompleted && !m.isLocked);
  const nextLesson = curMod?.lessons[0];

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <div
        ref={wrapRef}
        className="flex-1 relative overflow-hidden select-none"
        style={{ cursor: grabbing ? 'grabbing' : 'grab' }}
        onMouseDown={onMD}
      >
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}>
          <svg
            width={cW}
            height={C_H + 280}
            viewBox={`0 0 ${cW} ${C_H + 280}`}
            style={{ display: 'block', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B4F72" />
                <stop offset="40%" stopColor="#253550" />
                <stop offset="100%" stopColor="#1a2840" />
              </linearGradient>
              <linearGradient id="doneGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#15803D" />
                <stop offset="100%" stopColor="#22C55E" />
              </linearGradient>
              <filter id="roadShadow" x="-5%" y="-20%" width="110%" height="160%">
                <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor={isDark ? '#00000060' : '#00000030'} />
              </filter>
            </defs>

            {/* Road */}
            <path d={roadPath} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="56" strokeLinecap="round" transform="translate(0,8)" filter="url(#roadShadow)" />
            <path d={roadPath} fill="none" stroke="#141f30" strokeWidth="58" strokeLinecap="round" />
            <path d={roadPath} fill="none" stroke="url(#roadGrad)" strokeWidth="50" strokeLinecap="round" />

            {/* Completed overlay */}
            {totalCompleted > 0 && (
              <path d={roadPath} fill="none" stroke="url(#doneGrad)" strokeWidth="50" strokeLinecap="round"
                opacity="0.65"
                strokeDasharray={`${cW * (totalCompleted / modules.length)} ${cW}`}
              />
            )}

            <path d={roadPath} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="52" strokeLinecap="round" />
            <path d={roadPath} fill="none" stroke="url(#roadGrad)" strokeWidth="48" strokeLinecap="round" />
            <path d={roadPath} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="24" strokeLinecap="round" />
            <path d={roadPath} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="22 16" />

            {/* Number nodes */}
            {modules.map((mod, i) => (
              <NumberNode
                key={mod.id}
                x={pins[i].x}
                y={pins[i].y}
                segment={mod.segment}
                isCompleted={mod.isCompleted}
                isCurrent={mod.isCurrent}
                isLocked={mod.isLocked}
                isFinal={i === modules.length - 1}
                color={mod.pinColor}
                onClick={() => setSelected(mod)}
              />
            ))}

            {/* Lesson title labels */}
            {modules.map((mod, i) => (
              <LessonLabel
                key={`label-${mod.id}`}
                x={pins[i].x}
                y={pins[i].y}
                title={mod.title}
                isCompleted={mod.isCompleted}
                isCurrent={mod.isCurrent}
                isLocked={mod.isLocked}
                isDark={isDark}
              />
            ))}
          </svg>
        </div>
      </div>

      {/* Zoom controls */}
      <div
        className="absolute bottom-20 right-6 flex items-center rounded-2xl z-20"
        style={{ background: surfaceBg, border: `1px solid ${borderCol}`, boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.1)' }}
      >
        {[
          { label: '+', onClick: () => setZoom(z => Math.min(MAX_Z, +(z + 0.15).toFixed(2))), title: 'Zoom in' },
          { label: <Maximize2 size={15} />, onClick: () => { setZoom(1); setPan({ x: 0, y: 0 }); }, title: 'Reset' },
          { label: '−', onClick: () => setZoom(z => Math.max(MIN_Z, +(z - 0.15).toFixed(2))), title: 'Zoom out' },
        ].map((btn, i, arr) => (
          <div key={i} className="flex items-center">
            <button
              onClick={btn.onClick}
              title={btn.title}
              className="h-11 w-12 flex items-center justify-center transition-colors"
              style={{ color: textMuted, borderRadius: i === 0 ? '14px 0 0 14px' : i === arr.length - 1 ? '0 14px 14px 0' : '0' }}
              onMouseEnter={e => (e.currentTarget.style.background = isDark ? '#334155' : '#F3F4F6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {typeof btn.label === 'string' ? <span className="text-[20px] font-light leading-none">{btn.label}</span> : btn.label}
            </button>
            {i < arr.length - 1 && <div style={{ width: 1, height: 22, background: borderCol }} />}
          </div>
        ))}
      </div>

      {/* UP NEXT banner (image 2 style: dark pill) */}
      {curMod && nextLesson && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => onStart(nextLesson.id)}
            className="flex items-center gap-3 rounded-full px-4 py-2.5 transition-transform hover:scale-105"
            style={{
              background: isDark ? '#1C1C1E' : '#1F2937',
              boxShadow: '0 6px 28px rgba(0,0,0,0.35)',
            }}
          >
            <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: '#EF4444' }}>
              <Play size={13} className="text-white" fill="white" />
            </div>
            <div className="text-left">
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                Up Next: Learn
              </p>
              <p className="text-[12px] font-bold text-white">{nextLesson.title}</p>
            </div>
            <ChevronRight size={14} className="text-gray-500" />
          </button>
        </div>
      )}

      {/* Modal */}
      {selected && (
        <LessonModal
          mod={selected}
          isDark={isDark}
          onClose={() => setSelected(null)}
          onStart={(lid) => { setSelected(null); onStart(lid); }}
          onSkip={(lid) => { setSelected(null); onSkip(lid); }}
          totalCompleted={totalCompleted}
          total={modules.length}
        />
      )}
    </div>
  );
}

// ─── Root Page ────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { documentId } = useParams<{ documentId: string }>();
  const { user, token } = useAuth();
  const { getDocumentProgress } = useProgressContext();
  const pdfId = documentId ?? null;

  const [modules, setModules] = useState<Module[]>(MODULES);
  const [docTitle, setDocTitle] = useState('');
  const [loadingState, setLoadingState] = useState<'loading' | 'ready'>('loading');
  const [apiResolved, setApiResolved] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [usingFallback, setUsingFallback] = useState(false);
  const [fallbackDismissed, setFallbackDismissed] = useState(false);

  // Get completed lesson IDs from progress context
  const docProgress = pdfId ? getDocumentProgress(pdfId) : null;
  const completedLessonIds = docProgress?.completedLessons ?? [];
  const totalCompleted = completedLessonIds.length;

  useEffect(() => {
    let cancelled = false;
    const fetchLessons = async () => {
      if (!pdfId) {
        await new Promise<void>((r) => setTimeout(r, 3500));
        if (!cancelled) { setApiResolved(true); setLoadingState('ready'); }
        return;
      }
      const result = await pdfService.generateLessons(pdfId, user?.id ?? '', token ?? undefined);
      if (cancelled) return;
      if (result.success && result.data && result.data.lessons?.length > 0) {
        setDocTitle(result.data.title);
        setModules(mapLessonsToModules(result.data.lessons, completedLessonIds, result.data.title));
        setUsingFallback(false);
      } else {
        setModules(MODULES);
        setUsingFallback(true);
      }
      setApiResolved(true);
      setLoadingState('ready');
    };
    fetchLessons().catch(() => {
      if (!cancelled) { setModules(MODULES); setUsingFallback(true); setApiResolved(true); setLoadingState('ready'); }
    });
    return () => { cancelled = true; };
  }, [pdfId, user?.id, token, retryKey]);

  // Re-sync modules when completedLessonIds change (lesson marked complete in reader)
  useEffect(() => {
    setModules(prev => {
      if (usingFallback) return prev;
      return prev.map((mod, idx) => {
        const lessonId = mod.lessons[0]?.id;
        if (!lessonId) return mod;
        const isCompleted = completedLessonIds.includes(lessonId);
        const firstIncompleteIdx = prev.findIndex(m => !completedLessonIds.includes(m.lessons[0]?.id ?? ''));
        const isCurrent = idx === (firstIncompleteIdx === -1 ? prev.length - 1 : firstIncompleteIdx);
        const lastCompletedIdx = (() => {
          let last = -1;
          prev.forEach((m, i) => { if (completedLessonIds.includes(m.lessons[0]?.id ?? '')) last = i; });
          return last;
        })();
        const isLocked = idx > lastCompletedIdx + 1;
        return {
          ...mod,
          isCompleted,
          isCurrent,
          isLocked,
          percentage: isCompleted ? 100 : 0,
          lessonsCompleted: isCompleted ? 1 : 0,
          lessons: mod.lessons.map(l => ({ ...l, isCompleted: completedLessonIds.includes(l.id), isCurrent })),
        };
      });
    });
  }, [completedLessonIds.join(','), usingFallback]);

  if (loadingState === 'loading') {
    return (
      <RoadmapLoadingPage
        onClose={() => navigate('/dashboard')}
        apiResolved={apiResolved}
        onReady={() => setLoadingState('ready')}
      />
    );
  }

  const pageBg = isDark ? '#0f172a' : '#F0F2F5';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const textPri = isDark ? '#F1F5F9' : '#111827';
  const textMuted = isDark ? '#94A3B8' : '#6B7280';

  const totalLessons = modules.length;
  const progressPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;
  const displayTitle = docTitle || (usingFallback ? 'Sample Roadmap' : 'Loading…');

  const handleStart = (lessonId: string) => {
    navigate(`/reader/${pdfId ?? 'unknown'}/${lessonId}`);
  };
  const handleSkip = (lessonId: string) => {
    navigate(`/reader/${pdfId ?? 'unknown'}/${lessonId}`);
  };

  return (
    <>
      <style>{`
        @keyframes modalPop {
          0%   { transform: scale(0.9) translateY(10px); opacity: 0; }
          70%  { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1) translateY(0); }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: pageBg, fontFamily: 'Poppins, sans-serif' }}>
        {/* Header */}
        <header className="shrink-0 flex items-center px-5 py-8 gap-4 relative">
          <button
            onClick={() => navigate('/dashboard')}
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition hover:scale-105 cursor-pointer"
            style={{ background: pageBg, border: `1px solid ${borderCol}` }}
          >
            <X size={15} style={{ color: textMuted }} />
          </button>

          {/* Progress pill */}
          <div className="absolute left-1/2 -translate-x-1/2" style={{ width: 420 }}>
            <div className="rounded-2xl px-5 py-2.5" style={{
              background: isDark ? '#0f172a' : '#F9FAFB',
              border: `1px solid ${borderCol}`,
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.06)',
            }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[13px] font-semibold truncate max-w-[180px]" style={{ color: textPri }}>{displayTitle}</span>
                <span className="flex-1" />
                <span className="text-[11px]" style={{ color: textMuted }}>{totalCompleted}/{totalLessons} lessons</span>
                <span className="text-[14px] font-bold" style={{ color: '#22C55E' }}>{progressPct}%</span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: isDark ? '#334155' : '#E5E7EB' }}>
                <div className="h-full rounded-full" style={{
                  width: `${progressPct}%`,
                  background: 'linear-gradient(90deg,#3B82F6,#6366F1)',
                  transition: 'width 0.8s ease',
                }} />
              </div>
            </div>
          </div>

          <div className="flex-1" />

          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-xl transition hover:bg-opacity-80 shrink-0 cursor-pointer"
            style={{ background: pageBg, border: `1px solid ${borderCol}` }}
          >
            {isDark ? <Sun size={15} className="text-yellow-400" /> : <Moon size={15} style={{ color: textMuted }} />}
            <span className="text-[12px] font-medium" style={{ color: textMuted }}>
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </span>
          </button>
        </header>

        {/* Fallback banner */}
        {usingFallback && !fallbackDismissed && (
          <div className="shrink-0 flex items-center gap-3 px-5 py-2.5 text-sm"
            style={{ background: isDark ? '#1e3a5f' : '#EFF6FF', borderBottom: `1px solid ${isDark ? '#2563EB55' : '#BFDBFE'}`, color: isDark ? '#93C5FD' : '#1D4ED8' }}>
            <span>⚠️ Lesson data unavailable — showing demo roadmap.</span>
            <button onClick={() => { setLoadingState('loading'); setApiResolved(false); setUsingFallback(false); setRetryKey((k) => k + 1); }} className="underline font-medium hover:opacity-80 transition-opacity">Retry</button>
            <button onClick={() => setFallbackDismissed(true)} className="ml-auto hover:opacity-80 transition-opacity" aria-label="Dismiss">✕</button>
          </div>
        )}

        {/* Desktop */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          <DesktopRoadmap
            isDark={isDark} modules={modules}
            onStart={handleStart} onSkip={handleSkip}
            totalCompleted={totalCompleted}
          />
        </div>

        {/* Mobile */}
        <div className="flex md:hidden flex-1 overflow-y-auto">
          <div className="w-full">
            <MobileRoadmap
              isDark={isDark} modules={modules}
              onStart={handleStart} onSkip={handleSkip}
              totalCompleted={totalCompleted}
            />
          </div>
        </div>
      </div>
    </>
  );
}