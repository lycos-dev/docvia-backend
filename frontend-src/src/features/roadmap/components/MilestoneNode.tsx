import type { Milestone } from '../types';

interface MilestoneNodeProps {
  milestone: Milestone;
  position: { x: number; y: number };
  isCurrent: boolean;
  isNewlyUnlocked: boolean;
  onClick: () => void;
}

// Pure SVG icons — no foreignObject
function IconCheck() {
  return (
    <g stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="-7,0 -2,5 8,-6" fill="none" />
    </g>
  );
}

function IconLock() {
  return (
    <g fill="currentColor">
      <rect x="-6" y="-2" width="12" height="9" rx="2" fill="#9CA3AF" />
      <path
        d="M-4-2v-3a4 4 0 0 1 8 0v3"
        fill="none"
        stroke="#9CA3AF"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

function IconBook() {
  return (
    <g stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M-7,-6 L-7,6 Q0,4 7,6 L7,-6 Q0,-4 -7,-6 Z" />
      <line x1="0" y1="-5" x2="0" y2="5" />
    </g>
  );
}

export default function MilestoneNode({
  milestone,
  position,
  isCurrent,
  isNewlyUnlocked,
  onClick,
}: MilestoneNodeProps) {
  const { isCompleted, isUnlocked } = milestone;

  const fillColor = isCompleted
    ? '#10B981'
    : isCurrent
    ? '#3B82F6'
    : isUnlocked
    ? '#6366F1'
    : '#D1D5DB';

  const strokeColor = isCompleted
    ? '#059669'
    : isCurrent
    ? '#2563EB'
    : isUnlocked
    ? '#4F46E5'
    : '#9CA3AF';

  const isClickable = isUnlocked;

  return (
    <g
      transform={`translate(${position.x}, ${position.y})`}
      onClick={isClickable ? onClick : undefined}
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
      aria-label={`Chapter ${milestone.chapter}: ${milestone.title}`}
      role={isClickable ? 'button' : undefined}
    >
      {/* Unlock animation ring */}
      {isNewlyUnlocked && (
        <circle r="44" fill="none" stroke="#6366F1" strokeWidth="3">
          <animate
            attributeName="r"
            from="30"
            to="54"
            dur="0.6s"
            fill="freeze"
          />
          <animate
            attributeName="opacity"
            from="1"
            to="0"
            dur="0.6s"
            fill="freeze"
          />
        </circle>
      )}

      {/* Ping ring for current node */}
      {isCurrent && (
        <>
          <circle r="40" fill="#3B82F620">
            <animate
              attributeName="r"
              values="30;46;30"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.6;0;0.6"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </>
      )}

      {/* Shadow */}
      <circle r="30" fill="rgba(0,0,0,0.12)" transform="translate(2,4)" />

      {/* Main circle */}
      <circle
        r="28"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="3"
        style={{
          transition: 'fill 0.4s ease, stroke 0.4s ease',
          ...(isNewlyUnlocked
            ? { animation: 'milestoneUnlock 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }
            : {}),
        }}
      />

      {/* Icon */}
      {isCompleted ? (
        <IconCheck />
      ) : isUnlocked ? (
        <IconBook />
      ) : (
        <IconLock />
      )}

      {/* Chapter label below node */}
      <text
        y="46"
        textAnchor="middle"
        fontSize="12"
        fontWeight="600"
        fill="#374151"
        className="dark:fill-gray-200 select-none"
      >
        Ch {milestone.chapter}
      </text>

      <text
        y="60"
        textAnchor="middle"
        fontSize="10"
        fill="#6B7280"
        className="dark:fill-gray-400 select-none"
      >
        {milestone.title.length > 14
          ? milestone.title.slice(0, 13) + '…'
          : milestone.title}
      </text>

      {/* Points badge */}
      {isCompleted && (
        <g transform="translate(18, -18)">
          <circle r="11" fill="#F59E0B" stroke="#D97706" strokeWidth="1.5" />
          <text
            textAnchor="middle"
            y="4"
            fontSize="9"
            fontWeight="700"
            fill="white"
          >
            +{milestone.points >= 1000 ? `${Math.round(milestone.points / 100) / 10}k` : milestone.points}
          </text>
        </g>
      )}
    </g>
  );
}