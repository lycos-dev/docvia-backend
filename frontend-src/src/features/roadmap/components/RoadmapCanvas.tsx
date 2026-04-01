import { useState, useEffect, useRef, useCallback } from 'react';
import MilestoneNode from './MilestoneNode';
import MilestoneModal from './MilestoneModal';
import ConfettiOverlay from './ConfettiOverlay';
import { useRoadmapAnimation } from '../hooks/useRoadmapAnimation';
import {
  calculateMilestonePositions,
  generatePathString,
} from '../utils/pathCalculations';
import type { Milestone, Position } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────
const SVG_VIEWBOX_WIDTH  = 900;
const SVG_VIEWBOX_HEIGHT = 380;
const MIN_WIDTH          = 700;

// ─── Props ────────────────────────────────────────────────────────────────────
interface RoadmapCanvasProps {
  milestones: Milestone[];
  currentMilestoneIndex: number;
}

// ─── Low-poly SVG Car ─────────────────────────────────────────────────────────
function LowPolyCar({ x, y }: { x: number; y: number }) {
  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ filter: 'drop-shadow(2px 5px 6px rgba(0,0,0,0.35))' }}
    >
      {/* Ground shadow */}
      <ellipse cx="0" cy="19" rx="32" ry="6" fill="rgba(0,0,0,0.22)" />

      {/* Body facets */}
      <polygon points="-32,15 32,15 27,5 -27,5"  fill="#C0392B" />
      <polygon points="27,5 32,15 39,8 34,-1"     fill="#E74C3C" />
      <polygon points="-32,15 -27,5 -38,7 -39,14" fill="#922B21" />
      <polygon points="-27,5 27,5 22,-3 -22,-3"   fill="#E74C3C" />

      {/* Cabin */}
      <polygon points="-22,-3 -12,-14 12,-14 22,-3"  fill="#EC7063" />
      <polygon points="-12,-14 12,-14 8,-19 -8,-19"  fill="#F1948A" />

      {/* Glass */}
      <polygon points="12,-14 22,-3 19,-12"  fill="#AED6F1" opacity="0.85" />
      <polygon points="-12,-14 -22,-3 -19,-12" fill="#AED6F1" opacity="0.85" />
      <polygon points="-19,-12 -12,-14 12,-14 19,-12 16,-3 -16,-3"
        fill="#85C1E9" opacity="0.55" />

      {/* Hood */}
      <polygon points="22,-3 34,-1 30,5 27,5"  fill="#CB4335" />
      <polygon points="22,-3 28,-6 34,-1"       fill="#EC7063" />

      {/* Wheels */}
      <circle cx="22"  cy="15" r="8"   fill="#1a1a1a" />
      <circle cx="22"  cy="15" r="5"   fill="#2c2c2c" />
      <circle cx="22"  cy="15" r="2.5" fill="#aaaaaa" />
      <circle cx="-22" cy="15" r="8"   fill="#1a1a1a" />
      <circle cx="-22" cy="15" r="5"   fill="#2c2c2c" />
      <circle cx="-22" cy="15" r="2.5" fill="#aaaaaa" />

      {/* Headlight */}
      <rect x="32"  y="-0.5" width="6" height="4" rx="2" fill="#FEF08A" opacity="0.9" />
      {/* Taillight */}
      <rect x="-38" y="3"    width="5" height="4" rx="1.5" fill="#EF4444" opacity="0.9" />

      {/* Door line */}
      <line x1="-3" y1="-3" x2="-3" y2="5" stroke="#B03A2E" strokeWidth="0.7" opacity="0.5" />
      <line x1=" 3" y1="-3" x2=" 3" y2="5" stroke="#B03A2E" strokeWidth="0.7" opacity="0.5" />
    </g>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RoadmapCanvas({
  milestones,
  currentMilestoneIndex,
}: RoadmapCanvasProps) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef      = useRef<SVGPathElement>(null);

  // ── Dimensions ────────────────────────────────────────────────────────────
  const [containerSize, setContainerSize] = useState({
    width: MIN_WIDTH,
    height: SVG_VIEWBOX_HEIGHT,
  });

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      setContainerSize({
        width:  Math.max(width,  MIN_WIDTH),
        height: Math.max(height, SVG_VIEWBOX_HEIGHT),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── SVG milestone positions ────────────────────────────────────────────────
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    setPositions(
      calculateMilestonePositions(
        milestones.length,
        SVG_VIEWBOX_WIDTH,
        SVG_VIEWBOX_HEIGHT
      )
    );
  }, [milestones.length]);

  // ── Car position — just ahead of the first incomplete milestone ────────────
  const carPosition = useCallback((): Position => {
    if (positions.length === 0) return { x: 80, y: SVG_VIEWBOX_HEIGHT / 2 };
    // Sit just before the current milestone node
    const idx = Math.max(0, currentMilestoneIndex - 1);
    const pos = positions[idx];
    return { x: pos.x - 50, y: pos.y + 8 };
  }, [positions, currentMilestoneIndex]);

  // ── Roadmap animation (progress path) ─────────────────────────────────────
  const {
    animatedProgress,
    dashOffset,
    totalPathLength,
    newlyUnlocked,
    showConfetti,
    confettiOrigin,
  } = useRoadmapAnimation({
    milestones,
    positions,
    currentMilestoneIndex,
    pathEl:        pathRef.current,
    svgViewBox:    { width: SVG_VIEWBOX_WIDTH, height: SVG_VIEWBOX_HEIGHT },
    containerRect: containerSize,
    // No car movement callback needed — car position derived from milestone index
    onCarMove: () => {},
  });

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);

  const handleStartChapter = () => {
    console.log('Starting chapter:', selectedMilestone?.chapter);
    setSelectedMilestone(null);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const pathString  = generatePathString(positions);
  const progressPct = Math.round(animatedProgress * 100);
  const carPos      = carPosition();

  return (
    <div className="w-full space-y-4">

      {/* ── Progress header ───────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200">
              Learning Progress
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {currentMilestoneIndex + 1} of {milestones.length} chapters completed
            </p>
          </div>
          <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
            {progressPct}%
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-linear-to-r from-blue-500 via-indigo-500 to-emerald-500"
            style={{
              width: `${progressPct}%`,
              transition: 'width 1.1s cubic-bezier(0.25, 1, 0.5, 1)',
            }}
          />
        </div>
      </div>

      {/* ── Roadmap SVG ───────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        style={{ height: SVG_VIEWBOX_HEIGHT }}
      >
        {/* Confetti */}
        <ConfettiOverlay origin={confettiOrigin} active={showConfetti} />

        <div className="overflow-x-auto w-full h-full">
          <svg
            width={SVG_VIEWBOX_WIDTH}
            height={SVG_VIEWBOX_HEIGHT}
            viewBox={`0 0 ${SVG_VIEWBOX_WIDTH} ${SVG_VIEWBOX_HEIGHT}`}
            style={{ display: 'block', minWidth: MIN_WIDTH }}
            role="img"
            aria-label="Learning roadmap"
          >
            <defs>
              <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#3B82F6" />
                <stop offset="50%"  stopColor="#6366F1" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
              <filter id="roadShadow">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#00000020" />
              </filter>
            </defs>

            {/* Dot-grid background */}
            <defs>
              <pattern id="dotGrid" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="currentColor" opacity="0.06" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dotGrid)" />

            {/* Road base */}
            <path d={pathString} stroke="#E5E7EB" strokeWidth="52" fill="none"
              strokeLinecap="round" strokeLinejoin="round"
              className="dark:stroke-gray-700" filter="url(#roadShadow)" />
            <path d={pathString} stroke="#D1D5DB" strokeWidth="52" fill="none"
              strokeLinecap="round" strokeLinejoin="round"
              className="dark:stroke-gray-700" />
            <path d={pathString} stroke="#F9FAFB" strokeWidth="2" fill="none"
              strokeLinecap="round" className="dark:stroke-gray-600" opacity="0.7" />

            {/* Hidden path for geometry */}
            <path ref={pathRef} d={pathString} fill="none" stroke="none" strokeWidth="0" />

            {/* Progress overlay */}
            {totalPathLength > 0 && (
              <path
                d={pathString}
                stroke="url(#progressGrad)"
                strokeWidth="52"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={totalPathLength}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.25, 1, 0.5, 1)' }}
                opacity="0.55"
              />
            )}

            {/* Dashed center line */}
            <path d={pathString} stroke="white" strokeWidth="2" strokeDasharray="12 10"
              fill="none" strokeLinecap="round" opacity="0.6" className="dark:opacity-30" />

            {/* Milestone nodes */}
            {milestones.map((milestone, index) => (
              <MilestoneNode
                key={milestone.id}
                milestone={milestone}
                position={positions[index] ?? { x: 0, y: 0 }}
                isCurrent={index === currentMilestoneIndex}
                isNewlyUnlocked={newlyUnlocked.has(milestone.id)}
                onClick={() => setSelectedMilestone(milestone)}
              />
            ))}

            {/* SVG low-poly car */}
            <LowPolyCar x={carPos.x} y={carPos.y} />
          </svg>
        </div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 px-1 text-xs text-gray-500 dark:text-gray-400">
        {[
          { color: 'bg-emerald-500', label: 'Completed' },
          { color: 'bg-indigo-500',  label: 'Current'   },
          { color: 'bg-blue-400',    label: 'Unlocked'  },
          { color: 'bg-gray-300 dark:bg-gray-600', label: 'Locked' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
            {label}
          </span>
        ))}
      </div>

      {/* ── Milestone modal ───────────────────────────────────────────────── */}
      {selectedMilestone && (
        <MilestoneModal
          milestone={selectedMilestone}
          onClose={() => setSelectedMilestone(null)}
          onStart={handleStartChapter}
        />
      )}
    </div>
  );
}