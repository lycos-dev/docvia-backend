import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useId,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import RoadmapLoadingPage from "./RoadmapLoadingPage";
import { useAuth } from "../../../shared/contexts/AuthContext";
import { useProgressContext } from "../../../shared/contexts/ProgressContext";
import * as pdfService from "../../../shared/services/pdfService";
import type { BackendLesson } from "../../../shared/services/pdfService";
import {
  X,
  Moon,
  Sun,
  Play,
  ChevronRight,
  Maximize2,
  Check,
  Circle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { Button } from "../../../shared/components/ui/Button";
import { getVisitedLessonIds } from "../../../shared/utils/lessonVisitStorage";
import { useTimeTracker } from "../../../shared/hooks/useTimeTracker";

// ─── Embedded image assets ──────────────────────────────────────────────────
const CAR_IMG = "/assets/images/mobilecar.png";
const SCHOOL_IMG = "/assets/images/schoolimage.png";

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
  overview: string;
  isCompleted: boolean;
  isCurrent: boolean;
  hasVisitedContent: boolean;
  isLocked: boolean;
  percentage: number;
  lessonsCompleted: number;
  totalLessons: number;
  lessons: Lesson[];
  pinColor: string;
  pinEmoji: string;
}

// ─── Segment colors by progress state (not per-index rainbow) ────────────────
interface SegmentStatePalette {
  from: string;
  to: string;
  glow: string;
  border: string;
  textAccent: string;
}

const SEGMENT_NOT_STARTED_PALETTE: SegmentStatePalette = {
  from: "#2563EB",
  to: "#3B82F6",
  glow: "rgba(37,99,235,0.45)",
  border: "#1D4ED8",
  textAccent: "#1E40AF",
};

const SEGMENT_IN_PROGRESS_PALETTE: SegmentStatePalette = {
  from: "#F59E0B",
  to: "#FB923C",
  glow: "rgba(234,88,12,0.45)",
  border: "#D97706",
  textAccent: "#B45309",
};

const SEGMENT_COMPLETED_PALETTE: SegmentStatePalette = {
  from: "#15803D",
  to: "#166534",
  glow: "rgba(21,128,61,0.45)",
  border: "#14532D",
  textAccent: "#15803D",
};

/** Ahead on the path but previous segment not finished — neutral, not the blue “next” state. */
const SEGMENT_LOCKED_PALETTE: SegmentStatePalette = {
  from: "#9CA3AF",
  to: "#6B7280",
  glow: "rgba(107,114,128,0.35)",
  border: "#4B5563",
  textAccent: "#6B7280",
};

function moduleStatePalette(mod: {
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked?: boolean;
}): SegmentStatePalette {
  if (mod.isCompleted) return SEGMENT_COMPLETED_PALETTE;
  if (mod.isCurrent) return SEGMENT_IN_PROGRESS_PALETTE;
  if (mod.isLocked) return SEGMENT_LOCKED_PALETTE;
  return SEGMENT_NOT_STARTED_PALETTE;
}

const PIN_EMOJIS_LIST = ["🎯", "📦", "⚡", "🔍", "🏆", "💡", "🚀", "🌟"];

const SEEN_SEGMENT_MODAL_KEY = (docId: string) =>
  `docvia-segment-modal-seen:${docId}`;

function readSeenLessonIdsForDoc(docId: string): Set<string> {
  if (!docId) return new Set();
  try {
    const raw = localStorage.getItem(SEEN_SEGMENT_MODAL_KEY(docId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown[];
    return new Set(arr.map((id) => String(id)));
  } catch {
    return new Set();
  }
}

function markLessonSegmentModalSeen(docId: string, lessonId: string): void {
  if (!docId || !lessonId) return;
  const s = readSeenLessonIdsForDoc(docId);
  s.add(String(lessonId));
  localStorage.setItem(
    SEEN_SEGMENT_MODAL_KEY(docId),
    JSON.stringify([...s]),
  );
}

function formatLessonOverviewParagraph(overviewRaw: string): string {
  const t = overviewRaw.trim();
  if (!t) {
    return "This lesson will tackle the content for this segment once it is ready.";
  }
  const lower = t.toLowerCase();
  if (lower.startsWith("this lesson will tackle")) {
    return t.endsWith(".") ? t : `${t}.`;
  }
  const body = t.endsWith(".") ? t.slice(0, -1) : t;
  return `This lesson will tackle ${body}.`;
}

function shortSegmentOverview(raw: string, maxLen = 160): string {
  const t = raw.trim();
  if (!t) return "";
  const end = t.search(/[.!?](\s|$)/);
  let s = end >= 0 ? t.slice(0, end + 1).trim() : t;
  if (s.length > maxLen) {
    const cut = s.lastIndexOf(" ", maxLen - 1);
    s = `${cut > 24 ? s.slice(0, cut) : s.slice(0, maxLen - 1)}…`;
  }
  return s;
}

function mapLessonsToModules(
  lessons: BackendLesson[],
  completedLessonIds: string[],
  _docTitle: string,
  visitedLessonIds: Set<string>,
): Module[] {
  const completedSet = new Set(
    completedLessonIds.map((id) => String(id).trim()),
  );

  return lessons.map((lesson, idx) => {
    const lessonIdStr = String(lesson.id);
    const isCompleted = completedSet.has(lessonIdStr);
    const hasVisitedContent =
      visitedLessonIds.has(lessonIdStr) || isCompleted;

    const firstIncompleteIdx = lessons.findIndex(
      (l) => !completedSet.has(String(l.id)),
    );
    const isCurrent =
      idx ===
      (firstIncompleteIdx === -1 ? lessons.length - 1 : firstIncompleteIdx);

    const lastCompletedIdx = (() => {
      let last = -1;
      lessons.forEach((l, i) => {
        if (completedSet.has(String(l.id))) last = i;
      });
      return last;
    })();
    const isLocked = idx > lastCompletedIdx + 1;

    const overview =
      typeof lesson.explanation === "string"
        ? shortSegmentOverview(lesson.explanation)
        : "";

    return {
      id: `m${idx + 1}`,
      title: lesson.title,
      segment: idx + 1,
      overview,
      isCompleted,
      isCurrent,
      hasVisitedContent,
      isLocked,
      percentage: isCompleted ? 100 : 0,
      lessonsCompleted: isCompleted ? 1 : 0,
      totalLessons: 1,
      lessons: [
        {
          id: lessonIdStr,
          title: lesson.title,
          isCompleted,
          isCurrent,
          durationMin: 10,
        },
      ],
      pinColor: isCompleted
        ? SEGMENT_COMPLETED_PALETTE.from
        : isCurrent
          ? SEGMENT_IN_PROGRESS_PALETTE.from
          : isLocked
            ? SEGMENT_LOCKED_PALETTE.from
            : SEGMENT_NOT_STARTED_PALETTE.from,
      pinEmoji: PIN_EMOJIS_LIST[idx % PIN_EMOJIS_LIST.length],
    };
  });
}

// ─── SVG Road geometry ────────────────────────────────────────────────────────
const C_H = 380;
const ROAD_Y_CENTER = 160;
const WAVE_AMP = 90;
const PIN_SPACING = 260;
const MARGIN_X = 80;
const SVG_ROAD_Y_PAD = 175;

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
  if (pins.length < 2) return "";
  let d = `M ${pins[0].x} ${pins[0].y}`;
  for (let i = 1; i < pins.length; i++) {
    const prev = pins[i - 1];
    const curr = pins[i];
    const cpX = (prev.x + curr.x) / 2;
    d += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

/** Arc length along `pathEl` closest to `target` (path must match `roadPath` geometry). */
function lengthOnPathToNearestPoint(
  pathEl: SVGPathElement,
  target: { x: number; y: number },
  totalLen: number,
): number {
  const samples = Math.min(4000, Math.max(120, Math.ceil(totalLen * 4)));
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i <= samples; i++) {
    const s = (i / samples) * totalLen;
    const p = pathEl.getPointAtLength(s);
    const d = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/** Index of last segment completed in order from the start (no gaps). */
function lastContiguousCompletedIndex(modules: Module[]): number {
  let last = -1;
  for (let i = 0; i < modules.length; i++) {
    if (modules[i].isCompleted) last = i;
    else break;
  }
  return last;
}

// ─── Node layout constants ────────────────────────────────────────────────────
const NODE_R = 28;
const NODE_ELEVATION_ABOVE_ROAD = 118;

/** School image sitting above the last segment node, perfectly sized to match the node. */
function SchoolOnLastNode({
  pins,
  isDark,
}: {
  pins: Array<{ x: number; y: number }>;
  isDark: boolean;
}) {
  if (pins.length === 0) return null;
  const last = pins[pins.length - 1];
  const nodeY = last.y - NODE_ELEVATION_ABOVE_ROAD;
  const w = 160;
  const h = 124;
  return (
    <g style={{ pointerEvents: "none" }} aria-hidden>
      <image
        href={SCHOOL_IMG}
        xlinkHref={SCHOOL_IMG}
        x={last.x - w / 2}
        y={nodeY - NODE_R - h - 6}
        width={w}
        height={h}
        preserveAspectRatio="xMidYMax meet"
        style={{
          filter: isDark
            ? "drop-shadow(0 6px 18px rgba(0,0,0,0.6))"
            : "drop-shadow(0 6px 16px rgba(15,23,42,0.22))",
        }}
      />
    </g>
  );
}
const CARD_NODE_GAP = 18;
const PILL_PAD_X = 16;
const MIN_PILL_W = 130;
const MAX_PILL_W = 330;
/** Slightly conservative so bold Poppins titles stay inside the pill. */
const CHAR_EST_PX = 6.2;
const MAX_TITLE_LINES_IN_PILL = 3;

function wrapTitleForCard(title: string, maxCharsPerLine: number): string[] {
  const rawWords = title.split(/\s+/).filter(Boolean);
  const words: string[] = [];
  for (const w of rawWords) {
    if (w.length <= maxCharsPerLine) {
      words.push(w);
    } else {
      for (let i = 0; i < w.length; i += maxCharsPerLine) {
        words.push(w.slice(i, i + maxCharsPerLine));
      }
    }
  }
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxCharsPerLine && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function maxCharsForPillInnerWidth(pillW: number): number {
  const inner = pillW - 2 * PILL_PAD_X - 6;
  return Math.max(8, Math.floor(inner / CHAR_EST_PX));
}

function getPillTitleLayout(
  title: string,
  segment: number,
): { pillW: number; pillH: number; titleLines: string[] } {
  const segLabel = `Segment ${segment}`;
  let pillW = MAX_PILL_W;
  let wrapped: string[] = [""];

  for (let iter = 0; iter < 6; iter++) {
    const mcl = maxCharsForPillInnerWidth(pillW);
    wrapped = wrapTitleForCard(title.trim() || "Untitled", mcl);
    let maxLen = segLabel.length;
    for (const ln of wrapped) {
      maxLen = Math.max(maxLen, ln.length);
    }
    const nextW = Math.min(
      MAX_PILL_W,
      Math.max(MIN_PILL_W, Math.round(PILL_PAD_X * 2 + maxLen * CHAR_EST_PX)),
    );
    if (nextW === pillW) break;
    pillW = nextW;
  }

  const mclFinal = maxCharsForPillInnerWidth(pillW);
  wrapped = wrapTitleForCard(title.trim() || "Untitled", mclFinal);

  let titleLines: string[];
  if (wrapped.length > MAX_TITLE_LINES_IN_PILL) {
    const ell = "…";
    const room = Math.max(1, mclFinal - ell.length);
    const head = wrapped.slice(0, MAX_TITLE_LINES_IN_PILL - 1);
    const tailParts = wrapped.slice(MAX_TITLE_LINES_IN_PILL - 1);
    const tailJoined = tailParts.join(" ");
    const lastLine =
      tailJoined.length > room ? `${tailJoined.slice(0, room)}${ell}` : tailJoined;
    titleLines = [...head, lastLine];
  } else {
    titleLines = wrapped;
  }

  const nTitleLines = Math.min(
    MAX_TITLE_LINES_IN_PILL,
    Math.max(1, titleLines.length),
  );
  const pillH = 22 + nTitleLines * 13 + 20;

  return { pillW, pillH, titleLines };
}

function getCardLayout(
  x: number,
  roadY: number,
  title: string,
  segment: number,
): {
  roadY: number;
  nodeY: number;
  PILL_W: number;
  PILL_H: number;
  PILL_X: number;
  PILL_Y: number;
  titleLines: string[];
} {
  const nodeY = roadY - NODE_ELEVATION_ABOVE_ROAD;
  const { pillW, pillH, titleLines } = getPillTitleLayout(title, segment);
  const PILL_X = x - NODE_R - CARD_NODE_GAP - pillW;
  const PILL_Y = nodeY - pillH / 2;
  return {
    roadY,
    nodeY,
    PILL_W: pillW,
    PILL_H: pillH,
    PILL_X,
    PILL_Y,
    titleLines,
  };
}

// ─── Soft prompt when opening a segment before the previous one is done ─────────
function SegmentOutOfOrderPrompt({
  isDark,
  open,
  onGoBack,
  onContinue,
}: {
  isDark: boolean;
  open: boolean;
  onGoBack: () => void;
  onContinue: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onGoBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onGoBack]);

  if (!open) return null;

  const cardBg = isDark ? "rgba(30,41,59,0.94)" : "rgba(255,255,255,0.96)";
  const borderCol = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const textPri = isDark ? "#F1F5F9" : "#1F2937";
  const textSub = isDark ? "#94A3B8" : "#64748B";

  return (
    <>
      <div
        className="fixed inset-0 z-[54]"
        style={{ background: isDark ? "rgba(0,0,0,0.28)" : "rgba(15,23,42,0.12)" }}
        aria-hidden
        onClick={onGoBack}
      />
      <div
        className="fixed left-1/2 bottom-6 z-[55] w-[min(400px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl px-4 py-4 shadow-xl"
        style={{
          background: cardBg,
          border: `1px solid ${borderCol}`,
          backdropFilter: "blur(12px)",
          boxShadow: isDark
            ? "0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)"
            : "0 12px 40px rgba(15,23,42,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="roadmap-seg-order-title"
        onClick={(e) => e.stopPropagation()}
      >
        <p
          id="roadmap-seg-order-title"
          className="text-[14px] font-semibold leading-snug m-0"
          style={{ color: textPri, fontFamily: "Poppins,sans-serif" }}
        >
          You haven&apos;t completed the previous segment. Continue anyway?
        </p>
        <p className="text-[12px] leading-relaxed mt-2 mb-0" style={{ color: textSub, fontFamily: "Poppins,sans-serif" }}>
          You can return to earlier segments anytime.
        </p>
        <div className="flex flex-wrap justify-end gap-2 mt-4">
          <Button type="button" variant="ghost" size="sm" className="dark:text-slate-200" onClick={onGoBack}>
            Go Back
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onContinue}>
            Continue
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── NumberNode ───────────────────────────────────────────────────────────────
function NumberNode({
  x,
  y,
  segment,
  title,
  isCompleted,
  isCurrent,
  hasVisitedContent,
  isLocked,
  isDark,
  onClick,
}: {
  x: number;
  y: number;
  segment: number;
  title: string;
  isCompleted: boolean;
  isCurrent: boolean;
  hasVisitedContent: boolean;
  isLocked: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const r = NODE_R;
  const palette = moduleStatePalette({ isCompleted, isCurrent, isLocked });
  const { roadY, nodeY, PILL_W, PILL_H, PILL_X, PILL_Y } = getCardLayout(
    x,
    y,
    title,
    segment,
  );

  const nodeGradId = `nodeGrad-${segment}`;
  const nodeGlowId = `nodeGlowF-${segment}`;

  const accentCol = palette.from;

  const pillBg = isLocked
    ? isDark
      ? "rgba(30,41,59,0.9)"
      : "rgba(241,245,249,0.96)"
    : isDark
      ? "rgba(15,23,42,0.88)"
      : "rgba(255,255,255,0.94)";

  const pillBord = palette.border;

  const titleClr = isCompleted || isCurrent
    ? palette.textAccent
    : isLocked
      ? isDark
        ? "#94A3B8"
        : "#6B7280"
      : isDark
        ? "#F1F5F9"
        : "#111827";

  const CAR_W = 68;
  const CAR_H = 52;
  const carX = x - CAR_W / 2;
  const carY = nodeY - r - CAR_H - 8;

  const hoverScale = hovered ? "scale(1.06)" : "scale(1)";

  return (
    <g
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "pointer" }}
    >
      <defs>
        <radialGradient id={nodeGradId} cx="35%" cy="30%" r="70%">
          <stop
            offset="0%"
            stopColor={
              isCompleted
                ? "#22C55E"
                : isCurrent
                  ? "#FDE68A"
                  : isLocked
                    ? "#D1D5DB"
                    : palette.to
            }
          />
          <stop
            offset="100%"
            stopColor={
              isCompleted
                ? palette.to
                : isCurrent
                  ? palette.from
                  : isLocked
                    ? "#6B7280"
                    : palette.from
            }
          />
        </radialGradient>
        <filter id={nodeGlowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feComposite in="blur" in2="SourceGraphic" operator="over" />
        </filter>
      </defs>

      {/* Connector line from road to node */}
      <line
        x1={x}
        y1={roadY}
        x2={x}
        y2={nodeY + r}
        stroke={accentCol}
        strokeWidth="2.5"
        strokeDasharray="5 4"
        opacity={0.8}
        style={{ pointerEvents: "none" }}
      />

      {/* Current node pulse rings */}
      {isCurrent && (
        <>
          <circle cx={x} cy={nodeY} r={r + 18} fill={SEGMENT_IN_PROGRESS_PALETTE.from} opacity="0.12">
            <animate attributeName="r" values={`${r + 8};${r + 22};${r + 8}`} dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.18;0;0.18" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx={x} cy={nodeY} r={r + 9} fill={SEGMENT_IN_PROGRESS_PALETTE.from} opacity="0.18">
            <animate attributeName="r" values={`${r + 4};${r + 14};${r + 4}`} dur="2.4s" repeatCount="indefinite" begin="0.4s" />
            <animate attributeName="opacity" values="0.22;0;0.22" dur="2.4s" repeatCount="indefinite" begin="0.4s" />
          </circle>
        </>
      )}

      {/* Non-current hover glow */}
      {!isCurrent && hovered && (
        <circle
          cx={x}
          cy={nodeY}
          r={r + 10}
          fill={palette.from}
          opacity="0.18"
          filter={`url(#${nodeGlowId})`}
        />
      )}

      {/* Node drop shadow */}
      <circle cx={x + 3} cy={nodeY + 5} r={r + 1} fill="rgba(0,0,0,0.28)" />

      {/* Node outer ring */}
      <circle
        cx={x}
        cy={nodeY}
        r={r + 3}
        fill="none"
        stroke={accentCol}
        strokeWidth="2"
        opacity={0.65}
        strokeDasharray={isCurrent ? "none" : isCompleted ? "none" : "6 3"}
      />

      {/* Main node circle */}
      <circle
        cx={x}
        cy={nodeY}
        r={r}
        fill={`url(#${nodeGradId})`}
        style={{
          filter: hovered
            ? `drop-shadow(0 0 10px ${isCompleted ? "rgba(21,128,61,0.75)" : isCurrent ? "rgba(234,88,12,0.7)" : isLocked ? "rgba(107,114,128,0.45)" : palette.glow})`
            : `drop-shadow(0 2px 6px rgba(0,0,0,0.3))`,
          transform: hoverScale,
          transformOrigin: `${x}px ${nodeY}px`,
          transition: "transform 0.2s ease, filter 0.25s ease",
        }}
      />

      {/* Inner highlight shine */}
      <ellipse
        cx={x - r * 0.22}
        cy={nodeY - r * 0.28}
        rx={r * 0.38}
        ry={r * 0.22}
        fill="rgba(255,255,255,0.35)"
        style={{ pointerEvents: "none", opacity: isLocked ? 0.2 : 1 }}
      />

      {/* Node icon/number */}
      {isCompleted ? (
        <text x={x} y={nodeY + 6} textAnchor="middle" fontSize="18" fill="#fff" fontWeight="900" fontFamily="Poppins,sans-serif" style={{ userSelect: "none", pointerEvents: "none" }}>✓</text>
      ) : isLocked ? (
        <g style={{ pointerEvents: "none", userSelect: "none" as const }}>
          <text x={x} y={nodeY - 5} textAnchor="middle" fontSize="11" fill="#fff" opacity={0.88} style={{ textShadow: "0 1px 2px rgba(0,0,0,0.35)" }} aria-hidden>🔒</text>
          <text x={x} y={nodeY + 10} textAnchor="middle" fontSize="13" fill="#fff" fontWeight="800" fontFamily="Poppins,sans-serif" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>{segment}</text>
        </g>
      ) : (
        <text x={x} y={nodeY + 6} textAnchor="middle" fontSize="15" fill="#fff" fontWeight="800" fontFamily="Poppins,sans-serif" style={{ userSelect: "none", pointerEvents: "none", textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}>{segment}</text>
      )}

      {/* Car image (current segment) */}
      {isCurrent && (
        <g style={{ pointerEvents: "none" }}>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 0,-7; 0,0"
            dur="1.5s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
          />
          {isDark && (
            <ellipse
              cx={carX + CAR_W / 2}
              cy={carY + CAR_H + 2}
              rx={CAR_W * 0.45}
              ry={6}
              fill="rgba(253,224,71,0.18)"
              style={{ filter: "blur(4px)" }}
            />
          )}
          <image
            href={CAR_IMG}
            x={carX}
            y={carY}
            width={CAR_W}
            height={CAR_H}
            preserveAspectRatio="xMidYMid meet"
            style={{
              filter: isDark
                ? "drop-shadow(0 0 6px rgba(253,224,71,0.8)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
                : "drop-shadow(0 2px 6px rgba(0,0,0,0.3))",
            }}
          />
        </g>
      )}

      {/* Info card pill */}
      <rect
        x={PILL_X}
        y={PILL_Y}
        width={PILL_W}
        height={PILL_H}
        rx="14"
        fill={pillBg}
        stroke={pillBord}
        strokeWidth={hovered ? 2 : 1.5}
        opacity={1}
        style={{
          filter: hovered
            ? isDark
              ? `drop-shadow(0 8px 24px ${palette.glow}) drop-shadow(0 2px 8px rgba(0,0,0,0.4))`
              : `drop-shadow(0 8px 24px ${palette.glow}) drop-shadow(0 2px 8px rgba(0,0,0,0.15))`
            : "drop-shadow(0 2px 10px rgba(0,0,0,0.14))",
          backdropFilter: "blur(12px)",
          transition: "filter 0.25s ease, stroke-width 0.2s ease",
        }}
      />

      {/* Colored left accent bar on pill */}
      <rect
        x={PILL_X}
        y={PILL_Y + 4}
        width={4}
        height={PILL_H - 8}
        rx="2"
        fill={palette.from}
        opacity={0.92}
      />

      <text
        x={PILL_X + PILL_PAD_X + 2}
        y={PILL_Y + PILL_H - 20}
        fontSize="10.5"
        fontWeight="700"
        fill={titleClr}
        fontFamily="'Poppins', system-ui, sans-serif"
        letterSpacing="0.02em"
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        Segment {segment}
      </text>
      <text
        x={PILL_X + PILL_PAD_X + 2}
        y={PILL_Y + PILL_H - 6}
        fontSize="9.5"
        fill={
          isCompleted || isCurrent
            ? palette.textAccent
            : isDark
              ? "#94A3B8"
              : "#6B7280"
        }
        fontFamily="'Poppins', system-ui, sans-serif"
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {isCompleted
          ? "✓ Completed"
          : isCurrent && hasVisitedContent
            ? "▶ In Progress"
            : isCurrent
              ? "Ready to start"
              : "Not started"}
      </text>
    </g>
  );
}

// ─── Lesson title label on card ───────────────────────────────────────────────
function LessonLabel({
  x,
  y,
  title,
  segment,
  isCompleted,
  isCurrent,
  isLocked,
  isDark,
}: {
  x: number;
  y: number;
  title: string;
  segment: number;
  isCompleted: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  isDark: boolean;
}) {
  const clipUid = useId().replace(/:/g, "");
  const titleClipId = `pill-title-clip-${clipUid}-${segment}`;
  const { PILL_X, PILL_Y, PILL_W, PILL_H, titleLines } = getCardLayout(
    x,
    y,
    title,
    segment,
  );
  const palette = moduleStatePalette({ isCompleted, isCurrent, isLocked });

  const titleClr = isCompleted || isCurrent
    ? palette.textAccent
    : isLocked
      ? isDark
        ? "#94A3B8"
        : "#6B7280"
      : isDark
        ? "#F1F5F9"
        : "#111827";

  const titleTop = PILL_Y + 16;
  const clipPad = 2;
  const clipX = PILL_X + PILL_PAD_X;
  const clipY = PILL_Y + 8;
  const clipW = Math.max(0, PILL_W - 2 * PILL_PAD_X - clipPad);
  const clipH = Math.max(0, PILL_H - 36);

  return (
    <g style={{ pointerEvents: "none" }}>
      <defs>
        <clipPath id={titleClipId}>
          <rect x={clipX} y={clipY} width={clipW} height={clipH} rx={4} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${titleClipId})`}>
        {titleLines.map((line, i) => (
          <text
            key={i}
            x={PILL_X + PILL_PAD_X + 2}
            y={titleTop + i * 13}
            fontSize={i === 0 ? 10.5 : 9.5}
            fontWeight={i === 0 ? 700 : 500}
            fill={titleClr}
            opacity={i === 0 ? 1 : 0.88}
            fontFamily="'Poppins', system-ui, sans-serif"
            letterSpacing="0.01em"
            style={{ userSelect: "none" }}
          >
            {line}
          </text>
        ))}
      </g>
    </g>
  );
}

// ─── Lesson Modal ─────────────────────────────────────────────────────────────
function LessonModal({
  mod,
  isDark,
  pdfId,
  onClose,
  onStart,
  lockContinueAcknowledged = false,
}: {
  mod: Module;
  isDark: boolean;
  pdfId: string | null;
  onClose: () => void;
  onStart: (lessonId: string) => void;
  /** User already confirmed via the light out-of-order prompt; do not show a second blocking confirm. */
  lockContinueAcknowledged?: boolean;
}) {
  const palette = moduleStatePalette(mod);
  const surfaceBg = isDark ? "#0f1829" : "#FFFFFF";
  const textPri = isDark ? "#F1F5F9" : "#111827";
  const textMuted = isDark ? "#94A3B8" : "#6B7280";

  const lesson = mod.lessons[0];

  const isFirstOpenOfSegment =
    Boolean(lesson) &&
    (pdfId ? !readSeenLessonIdsForDoc(pdfId).has(String(lesson.id)) : true);

  const overviewParagraph = formatLessonOverviewParagraph(mod.overview);

  const primaryCtaLabel = (() => {
    if (!lesson) return "Start Reading";
    if (mod.isCompleted) return "Review Lesson";
    if (isFirstOpenOfSegment) return "Start Reading";
    return "Continue Reading";
  })();

  const handlePrimaryCta = (): void => {
    if (!lesson) return;
    if (mod.isLocked && !lockContinueAcknowledged) {
      const ok = window.confirm(
        "You haven't completed the previous segment. Continue anyway?\n\nYou can return to earlier segments anytime.",
      );
      if (!ok) return;
    }
    if (pdfId) markLessonSegmentModalSeen(pdfId, lesson.id);
    onStart(lesson.id);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: surfaceBg,
          borderRadius: 28,
          padding: "28px 26px",
          width: "min(440px, calc(100vw - 32px))",
          maxWidth: "calc(100vw - 32px)",
          boxShadow: isDark
            ? `0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04)`
            : `0 24px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)`,
          animation: "modalPop 0.32s cubic-bezier(0.34,1.56,0.64,1) both",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative top accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: `linear-gradient(90deg, ${palette.from}, ${palette.to})`,
            borderRadius: "28px 28px 0 0",
          }}
        />

        {/* Subtle background glow */}
        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${palette.from}22 0%, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            color: textMuted,
            lineHeight: 1,
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.1)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)")
          }
        >
          ×
        </button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, paddingTop: 8 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: `linear-gradient(135deg, ${palette.from}22, ${palette.to}11)`,
              border: `1.5px solid ${palette.from}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {mod.isCompleted ? (
              <Check size={26} style={{ color: SEGMENT_COMPLETED_PALETTE.from }} strokeWidth={2.5} />
            ) : mod.hasVisitedContent ? (
              <Loader2 size={26} style={{ color: palette.from, animationDuration: "2.2s" }} className="animate-spin" />
            ) : (
              <Circle size={26} style={{ color: palette.from }} strokeWidth={2} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 10.5, color: palette.from, margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, fontFamily: "Poppins,sans-serif" }}>
              Segment {mod.segment}
            </p>
            <p style={{ fontSize: 15, fontWeight: 700, color: textPri, margin: 0, lineHeight: 1.35, fontFamily: "Poppins,sans-serif" }}>
              {mod.title}
            </p>
          </div>
        </div>

        {/* Overview box */}
        <div
          style={{
            borderRadius: 16,
            padding: "16px 18px",
            marginBottom: 18,
            background: isDark
              ? `linear-gradient(145deg, ${palette.from}18 0%, rgba(15,24,42,0.95) 60%)`
              : `linear-gradient(145deg, ${palette.from}0f 0%, #FFFFFF 65%)`,
            border: `1px solid ${palette.from}44`,
          }}
        >
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.from, margin: "0 0 10px", fontFamily: "Poppins,sans-serif" }}>
            Lesson Overview
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: isDark ? "#CBD5E1" : "#374151", margin: 0, paddingLeft: 14, borderLeft: `3px solid ${palette.from}66`, fontFamily: "Poppins,sans-serif", fontWeight: 400, textAlign: "justify", textAlignLast: "left" }}>
            {overviewParagraph}
          </p>
        </div>

        {/* Out-of-order notice (recommended path: complete earlier lessons first) */}
        {mod.isLocked && lesson && (
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              marginBottom: 14,
              padding: "14px 16px",
              borderRadius: 16,
              background: isDark
                ? "linear-gradient(135deg, rgba(148,163,184,0.14) 0%, rgba(15,23,42,0.92) 100%)"
                : "linear-gradient(135deg, rgba(248,250,252,0.98) 0%, #FFFFFF 100%)",
              border: `1px solid ${isDark ? "rgba(148,163,184,0.35)" : "rgba(203,213,225,0.9)"}`,
              boxShadow: isDark
                ? "inset 0 1px 0 rgba(255,255,255,0.04)"
                : "0 2px 12px rgba(15,23,42,0.06)",
            }}
          >
            <AlertCircle
              size={22}
              strokeWidth={2.2}
              style={{
                color: isDark ? "#94A3B8" : "#64748B",
                flexShrink: 0,
                marginTop: 1,
              }}
              aria-hidden
            />
            <div>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isDark ? "#E2E8F0" : "#374151",
                  margin: "0 0 6px",
                  fontFamily: "Poppins,sans-serif",
                  letterSpacing: "0.02em",
                }}
              >
                Previous segment not completed yet
              </p>
              <p
                style={{
                  fontSize: 12.5,
                  lineHeight: 1.55,
                  color: isDark ? "#94A3B8" : "#64748B",
                  margin: 0,
                  fontFamily: "Poppins,sans-serif",
                  fontWeight: 400,
                }}
              >
                The path usually works best in order. You can still open this lesson when you&apos;re ready.
              </p>
            </div>
          </div>
        )}

        {/* CTA button */}
        {lesson && (
          <button
            type="button"
            onClick={handlePrimaryCta}
            style={{
              width: "100%",
              marginTop: mod.isLocked ? 0 : 4,
              background: mod.isCompleted
                ? `linear-gradient(135deg, ${SEGMENT_COMPLETED_PALETTE.to}, ${SEGMENT_COMPLETED_PALETTE.from})`
                : `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
              border: "none",
              borderRadius: 50,
              padding: "15px 24px",
              cursor: "pointer",
              boxShadow: `0 8px 24px ${mod.isCompleted ? "rgba(21,128,61,0.45)" : palette.glow}`,
              color: "#fff",
              fontWeight: 700,
              fontSize: 15,
              fontFamily: "Poppins,sans-serif",
              letterSpacing: "0.02em",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px) scale(1.01)";
              e.currentTarget.style.boxShadow = `0 12px 32px ${mod.isCompleted ? "rgba(21,128,61,0.55)" : palette.glow}`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "none";
              e.currentTarget.style.boxShadow = `0 8px 24px ${mod.isCompleted ? "rgba(21,128,61,0.45)" : palette.glow}`;
            }}
          >
            <span style={{ position: "relative", zIndex: 1 }}>
              {mod.isLocked && !mod.isCompleted ? "Open this lesson" : primaryCtaLabel}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Mobile Roadmap ───────────────────────────────────────────────────────────
function MobileRoadmap({
  isDark,
  modules,
  pdfId,
  onStart,
  totalCompleted,
}: {
  isDark: boolean;
  modules: Module[];
  pdfId: string | null;
  onStart: (lessonId: string) => void;
  totalCompleted: number;
}) {
  const [selected, setSelected] = useState<Module | null>(null);
  const [lockPromptModule, setLockPromptModule] = useState<Module | null>(null);
  const [lockContinueAcknowledged, setLockContinueAcknowledged] = useState(false);
  const textPri = isDark ? "#F1F5F9" : "#111827";
  const textMuted = isDark ? "#94A3B8" : "#6B7280";

  const openSegmentCard = useCallback((mod: Module) => {
    if (mod.isLocked && !mod.isCompleted) {
      setLockPromptModule(mod);
      return;
    }
    setLockContinueAcknowledged(false);
    setSelected(mod);
  }, []);

  const onLockPromptGoBack = useCallback(() => {
    setLockPromptModule(null);
  }, []);

  const onLessonModalClose = useCallback(() => {
    setSelected(null);
    setLockContinueAcknowledged(false);
  }, []);

  const allLessonsDone = modules.length > 0 && totalCompleted >= modules.length;
  const curMod =
    modules.find((m) => m.isCurrent) ??
    modules.find((m) => !m.isCompleted && !m.isLocked);
  const nextLesson = curMod?.lessons[0];

  return (
    <>
      <div
        className="relative px-4 py-6 pb-28 min-h-full overflow-hidden"
        style={{
          background: isDark
            ? "linear-gradient(180deg, rgba(30,41,59,0.8) 0%, transparent 40%)"
            : "linear-gradient(180deg, rgba(241,245,249,0.9) 0%, transparent 40%)",
        }}
      >
        {/* Ambient orbs */}
        <div className="roadmap-motion-ambient pointer-events-none absolute -top-24 -right-16 h-48 w-48 rounded-full blur-[56px] opacity-60"
          style={{ background: isDark ? "radial-gradient(circle, rgba(99,102,241,0.5) 0%, transparent 70%)" : "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)", animation: "roadmap-orb-drift 20s ease-in-out infinite" }}
          aria-hidden />
        <div className="roadmap-motion-ambient pointer-events-none absolute bottom-32 -left-20 h-44 w-44 rounded-full blur-[52px] opacity-50"
          style={{ background: "radial-gradient(circle, rgba(168,85,247,0.35) 0%, transparent 70%)", animation: "roadmap-orb-drift-alt 24s ease-in-out infinite" }}
          aria-hidden />

        <div className="relative z-[1]">
          {modules.map((mod, i) => {
            const palette = moduleStatePalette(mod);
            const borderColor = mod.isCompleted
              ? SEGMENT_COMPLETED_PALETTE.border
              : mod.isCurrent
                ? SEGMENT_IN_PROGRESS_PALETTE.border
                : mod.isLocked
                  ? SEGMENT_LOCKED_PALETTE.border
                  : `${palette.from}aa`;

            return (
              <div key={mod.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => openSegmentCard(mod)}
                    className="relative h-12 w-12 rounded-full flex items-center justify-center shrink-0 text-lg transition-all duration-300 hover:scale-110 active:scale-95"
                    style={{
                      background: mod.isCompleted
                        ? `linear-gradient(135deg, ${SEGMENT_COMPLETED_PALETTE.from}, ${SEGMENT_COMPLETED_PALETTE.to})`
                        : mod.isCurrent
                          ? "linear-gradient(135deg, #FDE68A, #F59E0B)"
                          : mod.isLocked
                            ? `linear-gradient(145deg, ${SEGMENT_LOCKED_PALETTE.from}, ${SEGMENT_LOCKED_PALETTE.to})`
                            : `linear-gradient(145deg, ${palette.from}, ${palette.to})`,
                      border: `2.5px solid ${borderColor}`,
                      boxShadow: mod.isCurrent
                        ? `0 0 0 4px rgba(245,158,11,0.28), 0 8px 22px rgba(234,88,12,0.28)`
                        : mod.isLocked
                          ? "0 4px 14px rgba(107,114,128,0.35), inset 0 1px 0 rgba(255,255,255,0.15)"
                          : !mod.isCompleted
                            ? `0 4px 16px ${palette.glow}, inset 0 1px 0 rgba(255,255,255,0.2)`
                            : mod.isCompleted
                              ? "0 4px 14px rgba(21,128,61,0.5)"
                              : "none",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 800,
                      fontFamily: "Poppins,sans-serif",
                    }}
                  >
                    {mod.isCompleted ? (
                      "✓"
                    ) : mod.isLocked ? (
                      <span className="flex flex-col items-center justify-center leading-none gap-0.5" aria-hidden>
                        <span className="text-[10px] opacity-90">🔒</span>
                        <span className="text-[12px] font-extrabold">{mod.segment}</span>
                      </span>
                    ) : (
                      mod.segment
                    )}

                    {/* Car on current */}
                    {mod.isCurrent && (
                      <span style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", width: 38, height: 30, animation: "carBounce 1.5s ease-in-out infinite", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isDark && (
                          <span aria-hidden style={{ position: "absolute", width: 44, height: 32, background: "radial-gradient(circle, rgba(253,224,71,0.3) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
                        )}
                        <img src={CAR_IMG} alt="" style={{ width: 38, height: 30, objectFit: "contain", display: "block", position: "relative", filter: isDark ? "drop-shadow(0 0 6px rgba(253,224,71,0.7))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }} />
                      </span>
                    )}
                  </button>

                  {/* Connector line */}
                  {i < modules.length - 1 && (
                    <div
                      className="w-0.5 flex-1 my-1.5 rounded-full"
                      style={{
                        background: mod.isCompleted
                          ? `linear-gradient(180deg, ${SEGMENT_COMPLETED_PALETTE.from}, ${SEGMENT_COMPLETED_PALETTE.to})`
                          : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)",
                        minHeight: 36,
                      }}
                    />
                  )}
                </div>

                {/* Info card */}
                <div className="flex-1 pb-6">
                  <button
                    type="button"
                    onClick={() => openSegmentCard(mod)}
                    className="w-full text-left rounded-2xl px-4 py-3.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.99] hover:-translate-y-0.5"
                    style={{
                      background: mod.isCurrent
                        ? isDark
                          ? `linear-gradient(145deg, ${palette.from}22 0%, #0f172a 52%)`
                          : `linear-gradient(145deg, ${palette.from}14 0%, #FFFFFF 58%)`
                        : mod.isLocked
                          ? isDark
                            ? "rgba(30,41,59,0.88)"
                            : "rgba(241,245,249,0.95)"
                          : isDark
                            ? "rgba(15,23,42,0.82)"
                            : "rgba(255,255,255,0.92)",
                      border: `1.5px solid ${mod.isCurrent ? palette.from + "90" : mod.isLocked ? (isDark ? "rgba(148,163,184,0.25)" : "rgba(203,213,225,0.85)") : isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.06)"}`,
                      boxShadow: mod.isCurrent
                        ? `0 0 0 3px ${palette.from}25, 0 10px 28px ${palette.glow}`
                        : `0 4px 16px rgba(0,0,0,${isDark ? "0.35" : "0.07"})`,
                      backdropFilter: "blur(10px)",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* Left accent */}
                    <div style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 3, borderRadius: "0 3px 3px 0", background: mod.isCompleted ? SEGMENT_COMPLETED_PALETTE.from : mod.isCurrent ? SEGMENT_IN_PROGRESS_PALETTE.from : mod.isLocked ? SEGMENT_LOCKED_PALETTE.from : palette.from }} />

                    <div className="flex items-center gap-2 mb-1 pl-1 min-w-0">
                      <span className="text-[13px] font-bold truncate min-w-0 flex-1" style={{ color: textPri, fontFamily: "Poppins,sans-serif" }}>
                        {mod.title}
                      </span>
                      {mod.isLocked && !mod.isCompleted && (
                        <span className="shrink-0 text-[11px] opacity-80" aria-hidden>🔒</span>
                      )}
                      {mod.isCurrent && <span title="You are here" style={{ fontSize: 14 }}>🚗</span>}
                      {mod.isCompleted && (
                        <span className="ml-auto text-[10px] font-bold" style={{ color: "#4ADE80" }}>✓ Done</span>
                      )}
                    </div>
                    <p className="text-[11px] pl-1" style={{ color: mod.isCurrent ? palette.from : textMuted, fontWeight: mod.isCurrent ? 600 : 400 }}>
                      {mod.isCompleted ? "Completed" : mod.isCurrent && mod.hasVisitedContent ? "In Progress" : mod.isCurrent ? "Ready to start" : "Not started"}
                    </p>
                  </button>
                </div>
              </div>
            );
          })}
          {modules.length > 0 && (
            <div className="flex gap-4 mt-2 pointer-events-none" aria-hidden>
              <div className="flex flex-col items-center shrink-0 w-12">
                <div
                  className="w-0.5 rounded-full"
                  style={{
                    minHeight: 44,
                    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)",
                  }}
                />
              </div>
              <div className="flex-1 flex justify-end items-end pb-1">
                <img
                  src={SCHOOL_IMG}
                  alt=""
                  style={{
                    width: 168,
                    maxHeight: 128,
                    objectFit: "contain",
                    objectPosition: "bottom right",
                    filter: isDark
                      ? "drop-shadow(0 14px 32px rgba(0,0,0,0.55))"
                      : "drop-shadow(0 14px 32px rgba(15,23,42,0.2))",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <SegmentOutOfOrderPrompt
          isDark={isDark}
          open={lockPromptModule !== null}
          onGoBack={onLockPromptGoBack}
          onContinue={() => {
            if (!lockPromptModule) return;
            const next = lockPromptModule;
            setLockPromptModule(null);
            setLockContinueAcknowledged(true);
            setSelected(next);
          }}
        />

        {selected && (
          <LessonModal
            mod={selected}
            isDark={isDark}
            pdfId={pdfId}
            lockContinueAcknowledged={lockContinueAcknowledged}
            onClose={onLessonModalClose}
            onStart={(lid) => {
              onLessonModalClose();
              onStart(lid);
            }}
          />
        )}
      </div>

      {/* Floating CTA */}
      {curMod && nextLesson && !allLessonsDone && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 w-[min(100%,calc(100vw-2rem))] px-1">
          <button
            type="button"
            onClick={() => onStart(nextLesson.id)}
            className="flex items-center gap-3 rounded-full px-5 py-3 w-full transition-all duration-300 active:scale-[0.98] cursor-pointer"
            style={{
              background: isDark
                ? "linear-gradient(135deg, #1e293b 0%, #0f172a 60%, #1e1b4b 100%)"
                : "linear-gradient(135deg, #fff 0%, #f1f5f9 100%)",
              boxShadow: isDark
                ? "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.3)"
                : "0 8px 28px rgba(15,23,42,0.15), 0 0 0 1px rgba(99,102,241,0.15)",
            }}
          >
            <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #6366F1, #4F46E5)", boxShadow: "0 4px 14px rgba(99,102,241,0.5)" }}>
              <Play size={14} className="text-white" fill="white" />
            </div>
            <div className="text-left min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: isDark ? "#94A3B8" : "#64748B" }}>
                {totalCompleted === 0 ? "Start reading" : "Up next"}
              </p>
              <p className="text-[12.5px] font-bold truncate" style={{ color: isDark ? "#F8FAFC" : "#0f172a" }}>
                {nextLesson.title}
              </p>
            </div>
            <ChevronRight size={15} className="shrink-0" style={{ color: isDark ? "#64748B" : "#94A3B8" }} />
          </button>
        </div>
      )}
    </>
  );
}

// ─── Desktop Roadmap ──────────────────────────────────────────────────────────
function DesktopRoadmap({
  isDark,
  modules,
  pdfId,
  onStart,
  totalCompleted,
}: {
  isDark: boolean;
  modules: Module[];
  pdfId: string | null;
  onStart: (lessonId: string) => void;
  totalCompleted: number;
}) {
  const [selected, setSelected] = useState<Module | null>(null);
  const [lockPromptModule, setLockPromptModule] = useState<Module | null>(null);
  const [lockContinueAcknowledged, setLockContinueAcknowledged] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isRecentering, setIsRecentering] = useState(false);
  const [grabbing, setGrab] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ dragging: false, sx: 0, sy: 0, px: 0, py: 0 });
  const roadPathMeasureRef = useRef<SVGPathElement | null>(null);
  const [doneOverlayLength, setDoneOverlayLength] = useState(0);
  const [pathTotalLength, setPathTotalLength] = useState(0);
  const MIN_Z = 0.4;
  const MAX_Z = 2.0;

  const borderCol = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const textMuted = isDark ? "#94A3B8" : "#6B7280";
  const surfaceBg = isDark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.9)";

  const roadMeshUid = useId().replace(/:/g, "");
  const roadMeshPatternId = `road-mesh-${roadMeshUid}`;
  const roadMeshMaskId = `road-mesh-mask-${roadMeshUid}`;
  const curbPatternId = `curb-${roadMeshUid}`;
  const doneGradId = `doneGrad-${roadMeshUid}`;
  const roadGradId = `roadGrad-${roadMeshUid}`;
  const roadEdgeGradId = `roadEdgeGrad-${roadMeshUid}`;

  const openSegmentCard = useCallback((mod: Module) => {
    if (mod.isLocked && !mod.isCompleted) {
      setLockPromptModule(mod);
      return;
    }
    setLockContinueAcknowledged(false);
    setSelected(mod);
  }, []);

  const onLockPromptGoBack = useCallback(() => {
    setLockPromptModule(null);
  }, []);

  const onLessonModalClose = useCallback(() => {
    setSelected(null);
    setLockContinueAcknowledged(false);
  }, []);

  const onMD = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      panRef.current = { dragging: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
      setGrab(true);
      e.preventDefault();
    },
    [pan],
  );

  useEffect(() => {
    const onMM = (e: MouseEvent) => {
      if (!panRef.current.dragging) return;
      setPan({ x: panRef.current.px + (e.clientX - panRef.current.sx), y: panRef.current.py + (e.clientY - panRef.current.sy) });
    };
    const onMU = () => { panRef.current.dragging = false; setGrab(false); };
    window.addEventListener("mousemove", onMM);
    window.addEventListener("mouseup", onMU);
    return () => { window.removeEventListener("mousemove", onMM); window.removeEventListener("mouseup", onMU); };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const fn = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(MAX_Z, Math.max(MIN_Z, +(z + (e.deltaY < 0 ? 0.08 : -0.08)).toFixed(2))));
    };
    el.addEventListener("wheel", fn, { passive: false });
    return () => el.removeEventListener("wheel", fn);
  }, []);

  const pins = useMemo(
    () => buildPins(modules.length).map((p) => ({ x: p.x, y: p.y + SVG_ROAD_Y_PAD })),
    [modules.length],
  );
  const cW = svgCanvasWidth(modules.length);
  const roadPath = useMemo(() => buildRoadPath(pins), [pins]);
  const svgH = C_H + 280 + SVG_ROAD_Y_PAD;

  const contiguousDoneKey = useMemo(
    () => modules.map((m) => (m.isCompleted ? "1" : "0")).join(""),
    [modules],
  );

  const modulesRef = useRef(modules);
  modulesRef.current = modules;

  useLayoutEffect(() => {
    const el = roadPathMeasureRef.current;
    const mods = modulesRef.current;
    if (!el || !roadPath || mods.length < 2) {
      setPathTotalLength(0);
      setDoneOverlayLength(0);
      return;
    }
    const total = el.getTotalLength();
    setPathTotalLength(total);
    const lastDone = lastContiguousCompletedIndex(mods);
    if (lastDone < 0) {
      setDoneOverlayLength(0);
    } else if (lastDone >= mods.length - 1) {
      setDoneOverlayLength(total);
    } else {
      // End at the node after the last completed leg so the first segment is not zero-length
      // (path starts at pin 0; completing segment 1 should fill through to pin 1).
      const targetPin = Math.min(lastDone + 1, pins.length - 1);
      const pt = pins[targetPin];
      setDoneOverlayLength(lengthOnPathToNearestPoint(el, pt, total));
    }
  }, [roadPath, pins, contiguousDoneKey]);

  const allLessonsDone = modules.length > 0 && totalCompleted >= modules.length;
  const curMod = modules.find((m) => m.isCurrent) ?? modules.find((m) => !m.isCompleted && !m.isLocked);
  const nextLesson = curMod?.lessons[0];

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute inset-0" style={{
          background: isDark
            ? "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(99,102,241,0.22) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(168,85,247,0.15) 0%, transparent 52%), radial-gradient(ellipse 55% 45% at 0% 90%, rgba(34,197,94,0.1) 0%, transparent 50%)"
            : "radial-gradient(ellipse 90% 55% at 50% -12%, rgba(99,102,241,0.15) 0%, transparent 52%), radial-gradient(ellipse 70% 48% at 100% 100%, rgba(168,85,247,0.1) 0%, transparent 50%), radial-gradient(ellipse 55% 40% at 0% 88%, rgba(34,197,94,0.07) 0%, transparent 48%)",
        }} />
        <div className="roadmap-motion-ambient absolute -top-[20%] -left-[10%] h-[55%] w-[55%] rounded-full blur-[80px]"
          style={{ background: isDark ? "radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)" : "radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 70%)", animation: "roadmap-orb-drift 18s ease-in-out infinite" }} />
        <div className="roadmap-motion-ambient absolute -bottom-[15%] -right-[8%] h-[50%] w-[48%] rounded-full blur-[72px]"
          style={{ background: isDark ? "radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)" : "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)", animation: "roadmap-orb-drift-alt 22s ease-in-out infinite" }} />
        <div className="roadmap-motion-ambient absolute top-[30%] right-[5%] h-[35%] w-[40%] rounded-full blur-[64px] opacity-60"
          style={{ background: "radial-gradient(circle, rgba(34,197,94,0.22) 0%, transparent 68%)", animation: "roadmap-orb-drift 26s ease-in-out infinite reverse" }} />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
          style={{ backgroundImage: `radial-gradient(${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.035)"} 1px, transparent 1px)`, backgroundSize: "28px 28px" }} />
        {/* Bottom fade */}
        <div className="absolute inset-0 opacity-40"
          style={{ background: isDark ? "linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(10,15,26,0.7) 100%)" : "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(226,232,240,0.8) 100%)" }} />
      </div>

      {/* Pannable canvas */}
      <div
        ref={wrapRef}
        className="flex-1 relative overflow-hidden select-none z-[1]"
        style={{ cursor: grabbing ? "grabbing" : "grab" }}
        onMouseDown={onMD}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
            transformOrigin: "center center",
            willChange: "transform",
            transition: isRecentering
              ? "transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)"
              : "none",
          }}
        >
          <svg
            width={cW}
            height={svgH}
            viewBox={`0 0 ${cW} ${svgH}`}
            style={{ display: "block", overflow: "visible" }}
          >
            <defs>
              {/* Road gradient - rich asphalt look */}
              <linearGradient id={roadGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isDark ? "#1a2540" : "#2a3650"} />
                <stop offset="40%" stopColor={isDark ? "#0d1626" : "#1a2540"} />
                <stop offset="100%" stopColor={isDark ? "#080e1c" : "#111827"} />
              </linearGradient>

              {/* Road edge highlight */}
              <linearGradient id={roadEdgeGradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
              </linearGradient>

              {/* Done section gradient */}
              <linearGradient id={doneGradId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#15803D" stopOpacity="0.78" />
                <stop offset="100%" stopColor="#22C55E" stopOpacity="0.62" />
              </linearGradient>

              {/* Road shadow filter */}
              <filter id="roadShadow" x="-5%" y="-20%" width="110%" height="160%">
                <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor={isDark ? "#00000070" : "#00000040"} />
              </filter>

              {/* Road surface mesh pattern */}
              <pattern id={roadMeshPatternId} patternUnits="userSpaceOnUse" width={20} height={20}>
                <rect width={20} height={20} fill="none" />
                {/* Primary grid */}
                <path d="M0 0 H20 M0 0 V20 M0 10 H20 M10 0 V20"
                  stroke={isDark ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.1)"}
                  strokeWidth={0.4} vectorEffect="non-scaling-stroke" fill="none" />
                {/* Diagonal weave */}
                <path d="M0 0 L20 20 M20 0 L0 20"
                  stroke={isDark ? "rgba(147,197,253,0.06)" : "rgba(186,230,253,0.08)"}
                  strokeWidth={0.3} vectorEffect="non-scaling-stroke" fill="none" />
                {/* Intersection dots */}
                <circle cx={10} cy={10} r={0.6} fill={isDark ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.11)"} />
                <circle cx={0} cy={0} r={0.5} fill={isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.09)"} />
                <circle cx={20} cy={0} r={0.5} fill={isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.09)"} />
                <circle cx={0} cy={20} r={0.5} fill={isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.09)"} />
              </pattern>

              {/* Road mesh mask */}
              <mask id={roadMeshMaskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x={0} y={0} width={cW} height={svgH}>
                <rect x={0} y={0} width={cW} height={svgH} fill="#000" />
                <path d={roadPath} fill="none" stroke="#fff" strokeWidth={52} strokeLinecap="round" />
              </mask>

              {/* Curb/edge stripe pattern */}
              <pattern id={curbPatternId} patternUnits="userSpaceOnUse" width={28} height={8}>
                <rect width={14} height={8} fill="rgba(255,220,0,0.75)" />
                <rect x={14} width={14} height={8} fill="rgba(30,30,30,0.6)" />
              </pattern>
            </defs>

            {/* Background sparkles */}
            <g style={{ pointerEvents: "none" }} opacity={isDark ? 0.5 : 0.6}>
              {[
                [0.06, 0.1], [0.18, 0.07], [0.38, 0.14], [0.58, 0.09],
                [0.78, 0.12], [0.92, 0.2], [0.12, 0.42], [0.48, 0.36],
                [0.72, 0.44], [0.88, 0.38], [0.3, 0.25], [0.65, 0.18],
              ].map(([fx, fy], i) => (
                <circle key={`sp-${i}`} cx={fx * cW} cy={fy * svgH} r={isDark ? 2.4 : 2.0}
                  fill={["#818cf8", "#a78bfa", "#60a5fa", "#34d399"][i % 4]}>
                  <animate attributeName="opacity" values="0.15;0.9;0.15" dur={`${2.0 + (i % 6) * 0.4}s`} repeatCount="indefinite" />
                  <animate attributeName="r" values={`${isDark ? 1.5 : 1.2};${isDark ? 2.8 : 2.4};${isDark ? 1.5 : 1.2}`} dur={`${2.0 + (i % 6) * 0.4}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </g>

            {/* === ROAD LAYERS (outermost → innermost) === */}

            {/* 1. Outer shadow */}
            <path d={roadPath} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="64"
              strokeLinecap="round" transform="translate(0,10)" filter="url(#roadShadow)" />

            {/* 2. Road border/curb outer glow */}
            <path d={roadPath} fill="none" stroke={isDark ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.18)"}
              strokeWidth="62" strokeLinecap="round" />

            {/* 3. Curb edge stripes (yellow/black) - gives road a real border */}
            <path d={roadPath} fill="none" stroke={`url(#${curbPatternId})`}
              strokeWidth="58" strokeLinecap="round" opacity="0.65"
              style={{ mixBlendMode: "overlay" }} />

            {/* 4. Road base asphalt */}
            <path
              ref={roadPathMeasureRef}
              d={roadPath}
              fill="none"
              stroke={`url(#${roadGradId})`}
              strokeWidth="52"
              strokeLinecap="round"
            />

            {/* 5. Surface texture mesh */}
            <rect x={0} y={0} width={cW} height={svgH}
              fill={`url(#${roadMeshPatternId})`}
              mask={`url(#${roadMeshMaskId})`}
              opacity={0.75}
              style={{ pointerEvents: "none", mixBlendMode: "soft-light" }} />

            {/* 6. Subtle inner shadow for depth */}
            <path d={roadPath} fill="none"
              stroke={isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.35)"}
              strokeWidth="40" strokeLinecap="round"
              style={{ mixBlendMode: "multiply" }} />

            {/* 7. Completed section overlay (length matches path geometry to each completed node) */}
            {doneOverlayLength > 0 && pathTotalLength > 0 && (
              <path
                d={roadPath}
                fill="none"
                stroke={`url(#${doneGradId})`}
                strokeWidth="52"
                strokeLinecap="round"
                opacity="0.52"
                strokeDasharray={`${doneOverlayLength} ${pathTotalLength + doneOverlayLength + 24}`}
              />
            )}

            {/* 8. Road surface sheen / highlight along top edge */}
            <path d={roadPath} fill="none"
              stroke={`url(#${roadEdgeGradId})`}
              strokeWidth="4" strokeLinecap="round" opacity="0.5" />

            {/* 9. Center dashed lane markings */}
            <path d={roadPath} fill="none"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray="24 18" />

            {/* 10. Second lane dash (offset) */}
            <path d={roadPath} fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.2" strokeLinecap="round"
              strokeDasharray="24 18"
              strokeDashoffset="21" />

            {/* === NODES === */}
            {modules.map((mod, i) => (
              <NumberNode
                key={mod.id}
                x={pins[i].x}
                y={pins[i].y}
                segment={mod.segment}
                title={mod.title}
                isCompleted={mod.isCompleted}
                isCurrent={mod.isCurrent}
                hasVisitedContent={mod.hasVisitedContent}
                isLocked={mod.isLocked}
                isDark={isDark}
                onClick={() => openSegmentCard(mod)}
              />
            ))}

            {/* Labels */}
            {modules.map((mod, i) => (
              <LessonLabel
                key={`label-${mod.id}`}
                x={pins[i].x}
                y={pins[i].y}
                title={mod.title}
                segment={mod.segment}
                isCompleted={mod.isCompleted}
                isCurrent={mod.isCurrent}
                isLocked={mod.isLocked}
                isDark={isDark}
              />
            ))}

            {/* School above last node — rendered last so it's on top */}
            <SchoolOnLastNode pins={pins} isDark={isDark} />
          </svg>
        </div>
      </div>

      {/* Zoom controls */}
      <div
        className="absolute bottom-5 right-8 flex items-center rounded-2xl z-20"
        style={{
          background: surfaceBg,
          border: `1px solid ${borderCol}`,
          boxShadow: isDark
            ? "0 4px 20px rgba(0,0,0,0.5)"
            : "0 4px 20px rgba(0,0,0,0.1)",
          userSelect: "none",
        }}
      >
        {[
          {
            label: "+",
            onClick: () =>
              setZoom((z) => Math.min(MAX_Z, +(z + 0.15).toFixed(2))),
            title: "Zoom in",
          },
          {
            label: <Maximize2 size={15} />,
            onClick: () => {
              setIsRecentering(true);
              setZoom(1);
              const curIdx = modules.findIndex((m) => m.isCurrent);
              const targetIdx =
                curIdx !== -1
                  ? curIdx
                  : modules.findIndex((m) => !m.isCompleted && !m.isLocked);
              if (targetIdx !== -1 && pins[targetIdx]) {
                const pin = pins[targetIdx];
                const svgMidX = svgCanvasWidth(modules.length) / 2;
                const svgMidY = (C_H + 500 + SVG_ROAD_Y_PAD) / 2;
                setPan({ x: -(pin.x - svgMidX), y: -(pin.y - svgMidY) });
              } else {
                setPan({ x: 0, y: 0 });
              }
              setTimeout(() => setIsRecentering(false), 600);
            },
            title: "Reset",
          },
          {
            label: "−",
            onClick: () =>
              setZoom((z) => Math.max(MIN_Z, +(z - 0.15).toFixed(2))),
            title: "Zoom out",
          },
        ].map((btn, i, arr) => (
          <div key={i} className="flex items-center">
            <button
              onClick={btn.onClick}
              title={btn.title}
              className="h-11 w-12 flex items-center justify-center transition-colors cursor-pointer"
              style={{
                color: textMuted,
                borderRadius:
                  i === 0
                    ? "14px 0 0 14px"
                    : i === arr.length - 1
                      ? "0 14px 14px 0"
                      : "0",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = isDark
                  ? "#334155"
                  : "#F3F4F6")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              {typeof btn.label === "string" ? (
                <span className="text-[20px] font-light leading-none">
                  {btn.label}
                </span>
              ) : (
                btn.label
              )}
            </button>
            {i < arr.length - 1 && (
              <div style={{ width: 1, height: 22, background: borderCol }} />
            )}
          </div>
        ))}
      </div>

      {/* Up Next Banner */}
      {curMod && nextLesson && !allLessonsDone && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 px-3">
          <button
            type="button"
            onClick={() => onStart(nextLesson.id)}
            className="flex items-center gap-3 rounded-full px-5 py-3 transition-all duration-300 hover:scale-[1.04] hover:shadow-xl active:scale-[0.98] cursor-pointer"
            style={{
              background: isDark
                ? "linear-gradient(135deg, #1e293b 0%, #0f172a 55%, #1e1b4b 100%)"
                : "linear-gradient(135deg, #fff 0%, #f1f5f9 100%)",
              boxShadow: isDark
                ? "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.3), 0 0 40px rgba(99,102,241,0.12)"
                : "0 8px 28px rgba(15,23,42,0.15), 0 0 0 1px rgba(99,102,241,0.18)",
            }}
          >
            <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #6366F1, #4F46E5)", boxShadow: "0 4px 16px rgba(99,102,241,0.55)" }}>
              <Play size={14} className="text-white" fill="white" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: isDark ? "#94A3B8" : "#64748B" }}>
                {totalCompleted === 0 ? "Start reading" : "Up next"}
              </p>
              <p className="text-[12.5px] font-bold max-w-[220px] truncate" style={{ color: isDark ? "#F8FAFC" : "#0f172a" }}>
                {nextLesson.title}
              </p>
            </div>
            <ChevronRight size={14} className="shrink-0" style={{ color: isDark ? "#64748B" : "#94A3B8" }} />
          </button>
        </div>
      )}

      <SegmentOutOfOrderPrompt
        isDark={isDark}
        open={lockPromptModule !== null}
        onGoBack={onLockPromptGoBack}
        onContinue={() => {
          if (!lockPromptModule) return;
          const next = lockPromptModule;
          setLockPromptModule(null);
          setLockContinueAcknowledged(true);
          setSelected(next);
        }}
      />

      {selected && (
        <LessonModal
          mod={selected}
          isDark={isDark}
          pdfId={pdfId}
          lockContinueAcknowledged={lockContinueAcknowledged}
          onClose={onLessonModalClose}
          onStart={(lid) => {
            onLessonModalClose();
            onStart(lid);
          }}
        />
      )}
    </div>
  );
}

// ─── Root Page ────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const { documentId } = useParams<{ documentId: string }>();
  const { user, token } = useAuth();
  const { getDocumentProgress } = useProgressContext();
  const pdfId = documentId ?? null;

  const [modules, setModules] = useState<Module[]>([]);
  const [docTitle, setDocTitle] = useState("");
  const [loadingState, setLoadingState] = useState<"loading" | "ready">("loading");
  const [apiResolved, setApiResolved] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [visitBump, setVisitBump] = useState(0);

  useEffect(() => {
    const onVisit = () => setVisitBump((n) => n + 1);
    window.addEventListener("docvia-lesson-content-visited", onVisit);
    return () => window.removeEventListener("docvia-lesson-content-visited", onVisit);
  }, []);

  const docProgress = pdfId ? getDocumentProgress(pdfId) : null;
  const completedLessonIds = docProgress?.completedLessons ?? [];
  const totalCompleted = completedLessonIds.length;

  useEffect(() => {
    let cancelled = false;
    const fetchLessons = async () => {
      if (!pdfId) {
        await new Promise<void>((r) => setTimeout(r, 3500));
        if (!cancelled) { setApiResolved(true); setLoadingState("ready"); }
        return;
      }
      const result = await pdfService.generateLessons(pdfId, user?.id ?? "", token ?? undefined);
      if (cancelled) return;
      if (result.success && result.data && result.data.lessons?.length > 0) {
        setDocTitle(result.data.title);
        setModules(mapLessonsToModules(result.data.lessons, completedLessonIds, result.data.title, pdfId ? getVisitedLessonIds(pdfId) : new Set<string>()));
        setErrorMessage(null);
      } else {
        await pdfService.deleteLessons(pdfId, user?.id ?? "", token ?? undefined).catch(() => {});
        const msg = (result as { error?: string; message?: string }).message || (result as { error?: string }).error || "Could not generate lessons for this document. It may be blank, password-protected, or unreadable.";
        setErrorMessage(msg);
        setModules([]);
      }
      setApiResolved(true);
      setLoadingState("ready");
    };
    fetchLessons().catch((err: unknown) => {
      if (!cancelled) {
        if (pdfId && user?.id) { pdfService.deleteLessons(pdfId, user.id, token ?? undefined).catch(() => {}); }
        const msg = err instanceof Error ? err.message : "An unexpected error occurred while generating lessons.";
        setErrorMessage(msg);
        setModules([]);
        setApiResolved(true);
        setLoadingState("ready");
      }
    });
    return () => { cancelled = true; };
  }, [pdfId, user?.id, token, retryKey]);

  useEffect(() => {
    const done = new Set(completedLessonIds.map((id) => String(id).trim()));
    const visited = pdfId ? getVisitedLessonIds(pdfId) : new Set<string>();
    setModules((prev) => {
      if (prev.length === 0) return prev;
      return prev.map((mod, idx) => {
        const lessonId = mod.lessons[0]?.id;
        if (!lessonId) return mod;
        const isCompleted = done.has(String(lessonId));
        const hasVisitedContent = visited.has(String(lessonId)) || isCompleted;
        const firstIncompleteIdx = prev.findIndex((m) => !done.has(String(m.lessons[0]?.id ?? "")));
        const isCurrent = idx === (firstIncompleteIdx === -1 ? prev.length - 1 : firstIncompleteIdx);
        const lastCompletedIdx = (() => {
          let last = -1;
          prev.forEach((m, i) => { if (done.has(String(m.lessons[0]?.id ?? ""))) last = i; });
          return last;
        })();
        const isLocked = idx > lastCompletedIdx + 1;
        return {
          ...mod,
          isCompleted,
          isCurrent,
          hasVisitedContent,
          isLocked,
          percentage: isCompleted ? 100 : 0,
          lessonsCompleted: isCompleted ? 1 : 0,
          lessons: mod.lessons.map((l) => ({ ...l, isCompleted: done.has(String(l.id)), isCurrent })),
        };
      });
    });
  }, [completedLessonIds.join(","), visitBump, pdfId]);

  const roadmapTimerLessonId = useMemo(() => {
    if (modules.length === 0) return null;
    const current = modules.find((m) => m.isCurrent);
    const id = current?.lessons[0]?.id ?? modules[0]?.lessons[0]?.id;
    return id ? String(id) : null;
  }, [modules]);

  useTimeTracker({ documentId: pdfId, lessonId: roadmapTimerLessonId });

  if (loadingState === "loading") {
    return <RoadmapLoadingPage onClose={() => navigate("/dashboard")} apiResolved={apiResolved} onReady={() => setLoadingState("ready")} />;
  }

  // Error state
  if (errorMessage) {
    const pageBgErr = isDark ? "#080e1c" : "#F0F2F5";
    const borderColErr = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    const textMutedErr = isDark ? "#94A3B8" : "#6B7280";
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6"
        style={{ background: pageBgErr, fontFamily: "Poppins, sans-serif" }}>
        <button onClick={() => navigate("/dashboard")}
          className="absolute top-5 left-5 h-9 w-9 rounded-full flex items-center justify-center transition hover:scale-105 cursor-pointer"
          style={{ background: pageBgErr, border: `1px solid ${borderColErr}` }}>
          <X size={15} style={{ color: textMutedErr }} />
        </button>
        <div className="w-full max-w-md rounded-3xl p-8 flex flex-col items-center text-center gap-4"
          style={{ background: isDark ? "#0d1626" : "#FFFFFF", border: `1px solid ${borderColErr}`, boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.6)" : "0 8px 32px rgba(0,0,0,0.08)" }}>
          <div className="h-16 w-16 rounded-full flex items-center justify-center text-3xl"
            style={{ background: isDark ? "rgba(127,29,29,0.3)" : "#FEF2F2" }}>📄</div>
          <div>
            <h2 className="text-lg font-bold mb-1" style={{ color: isDark ? "#F1F5F9" : "#111827" }}>Couldn't Generate Lessons</h2>
            <p className="text-sm leading-relaxed" style={{ color: textMutedErr }}>{errorMessage}</p>
          </div>
          <div className="flex flex-col gap-2 w-full pt-2">
            <button
              onClick={() => { setErrorMessage(null); setLoadingState("loading"); setApiResolved(false); setRetryKey((k) => k + 1); }}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition hover:opacity-90 cursor-pointer"
              style={{ background: "linear-gradient(135deg, #6366F1, #4F46E5)" }}>
              Try Again
            </button>
            <button onClick={() => navigate("/dashboard")}
              className="w-full py-3 rounded-2xl text-sm font-semibold transition hover:opacity-80 cursor-pointer"
              style={{ background: isDark ? "#1e293b" : "#F3F4F6", color: textMutedErr }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const pageBg = isDark ? "#080e1c" : "#F0F2F5";
  const borderCol = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const textPri = isDark ? "#F1F5F9" : "#111827";
  const textMuted = isDark ? "#94A3B8" : "#6B7280";

  const totalLessons = modules.length;
  const progressPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;
  const displayTitle = docTitle || "Loading…";

  const handleStart = (lessonId: string) => navigate(`/reader/${pdfId ?? "unknown"}/${lessonId}`);

  return (
    <>
      <style>{`
        @keyframes modalPop {
          0%   { transform: scale(0.88) translateY(12px); opacity: 0; }
          70%  { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes carBounce {
          0%, 100% { transform: translateX(-50%) translateY(0px); }
          50%       { transform: translateX(-50%) translateY(-7px); }
        }
        @keyframes roadmap-orb-drift {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          33%       { transform: translate(4%, 3%) scale(1.06); }
          66%       { transform: translate(-3%, 2%) scale(0.95); }
        }
        @keyframes roadmap-orb-drift-alt {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          40%       { transform: translate(-5%, -4%) scale(1.08); }
          70%       { transform: translate(3%, 5%) scale(0.94); }
        }
        @keyframes roadmap-bar-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .roadmap-motion-ambient {
          will-change: transform;
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex flex-col"
        style={{
          background: isDark
            ? "linear-gradient(160deg, #080e1c 0%, #0c1424 45%, #0a0f1a 100%)"
            : "linear-gradient(160deg, #eef2ff 0%, #f1f5f9 45%, #f8fafc 100%)",
          fontFamily: "Poppins, sans-serif",
        }}
      >
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-30 flex items-center px-5 py-8 gap-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition hover:scale-105 cursor-pointer"
            style={{
              background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
              border: `1px solid ${borderCol}`,
              backdropFilter: "blur(8px)",
            }}
          >
            <X size={15} style={{ color: textMuted }} />
          </button>

          {/* Progress pill */}
          <div className="absolute left-1/2 -translate-x-1/2" style={{ width: "min(440px, calc(100vw - 7rem))" }}>
            <div
              className="rounded-2xl px-5 py-3"
              style={{
                background: isDark ? "rgba(8,14,28,0.75)" : "rgba(255,255,255,0.85)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
                boxShadow: isDark
                  ? "0 4px 20px rgba(0,0,0,0.4)"
                  : "0 4px 20px rgba(0,0,0,0.06)",
                userSelect: "none",
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="text-[13px] font-semibold truncate max-w-45"
                  style={{ color: textPri }}
                >
                  {displayTitle}
                </span>
                <span className="flex-1" />
                <span className="text-[11px]" style={{ color: textMuted }}>
                  {totalCompleted}/{totalLessons} done
                </span>
                <span className="text-[14px] font-bold" style={{ color: progressPct === 100 ? "#22C55E" : "#6366F1" }}>
                  {progressPct}%
                </span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 7, background: isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.15)" }}>
                <div
                  className="roadmap-motion-ambient h-full rounded-full relative overflow-hidden"
                  style={{
                    width: `${progressPct}%`,
                    background: progressPct === 100
                      ? "linear-gradient(90deg, #16A34A, #22C55E)"
                      : "linear-gradient(90deg, #6366F1, #818cf8, #a78bfa, #818cf8)",
                    backgroundSize: "200% 100%",
                    transition: "width 0.8s ease",
                    animation: progressPct > 0 && progressPct < 100 ? "roadmap-bar-shimmer 3s linear infinite" : undefined,
                    boxShadow: progressPct > 0 ? `0 0 8px ${progressPct === 100 ? "rgba(34,197,94,0.6)" : "rgba(99,102,241,0.5)"}` : undefined,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex-1" />

          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-xl transition hover:bg-opacity-80 shrink-0 cursor-pointer"
            style={{ background: pageBg, border: `1px solid ${borderCol}`, userSelect: "none" }}
          >
            {isDark ? <Sun size={15} className="text-yellow-400" /> : <Moon size={15} style={{ color: textMuted }} />}
            <span className="text-[12px] font-medium" style={{ color: textMuted }}>
              {isDark ? "Dark" : "Light"}
            </span>
          </button>
        </header>

        {/* Desktop */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          <DesktopRoadmap isDark={isDark} modules={modules} pdfId={pdfId} onStart={handleStart} totalCompleted={totalCompleted} />
        </div>

        {/* Mobile */}
        <div className="flex md:hidden flex-1 overflow-y-auto">
          <div className="w-full">
            <MobileRoadmap isDark={isDark} modules={modules} pdfId={pdfId} onStart={handleStart} totalCompleted={totalCompleted} />
          </div>
        </div>
      </div>
    </>
  );
}