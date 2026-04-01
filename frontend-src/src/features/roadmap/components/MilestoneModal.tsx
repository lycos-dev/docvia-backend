import { X, Trophy, Star, Lock, BookOpen, RotateCcw } from 'lucide-react';
import type { Milestone } from '../types';

interface MilestoneModalProps {
  milestone: Milestone;
  onClose: () => void;
  onStart?: () => void;
}

export default function MilestoneModal({
  milestone,
  onClose,
  onStart,
}: MilestoneModalProps) {
  const { isCompleted, isUnlocked } = milestone;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Entry animation wrapper */}
      <div
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{ animation: 'modalPop 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}
      >
        {/* Colored top bar */}
        <div
          className={`h-1.5 w-full ${
            isCompleted
              ? 'bg-linear-to-r from-emerald-400 to-green-500'
              : isUnlocked
              ? 'bg-linear-to-r from-blue-500 to-indigo-500'
              : 'bg-gray-300 dark:bg-gray-600'
          }`}
        />

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-11 w-11 rounded-2xl flex items-center justify-center shadow-sm ${
                isCompleted
                  ? 'bg-emerald-100 dark:bg-emerald-900/30'
                  : isUnlocked
                  ? 'bg-blue-100 dark:bg-blue-900/30'
                  : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              {isCompleted ? (
                <Trophy className="text-emerald-600 dark:text-emerald-400" size={20} />
              ) : isUnlocked ? (
                <BookOpen className="text-blue-600 dark:text-blue-400" size={20} />
              ) : (
                <Lock className="text-gray-400" size={20} />
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Chapter {milestone.chapter}
              </p>
              <h3
                id="modal-title"
                className="text-base font-bold text-gray-800 dark:text-gray-100 leading-tight"
              >
                {milestone.title}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {milestone.description}
          </p>

          {/* Stats row */}
          <div className="flex gap-3">
            <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-2xl px-4 py-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Points</p>
              <p className="text-lg font-bold text-amber-500">+{milestone.points}</p>
            </div>
            <div className="flex-1 bg-gray-50 dark:bg-gray-700/50 rounded-2xl px-4 py-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <p
                className={`text-sm font-semibold ${
                  isCompleted
                    ? 'text-emerald-500'
                    : isUnlocked
                    ? 'text-blue-500'
                    : 'text-gray-400'
                }`}
              >
                {isCompleted ? '✓ Done' : isUnlocked ? 'Ready' : 'Locked'}
              </p>
            </div>
          </div>

          {/* Status message */}
          {!isUnlocked && (
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              🔒 Complete previous chapters to unlock this stage
            </p>
          )}

          {isCompleted && (
            <div className="flex items-center justify-center gap-1.5">
              {[...Array(3)].map((_, i) => (
                <Star
                  key={i}
                  size={18}
                  className="fill-amber-400 text-amber-400"
                />
              ))}
              <span className="text-xs text-amber-500 font-medium ml-1">
                Chapter completed!
              </span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 flex gap-3">
          {isCompleted ? (
            <button
              onClick={onStart}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-2xl text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <RotateCcw size={15} />
              Review Chapter
            </button>
          ) : isUnlocked ? (
            <button
              onClick={onStart}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-2xl text-sm font-semibold transition-all"
            >
              Start Chapter →
            </button>
          ) : (
            <button
              disabled
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-2xl text-sm font-semibold cursor-not-allowed"
            >
              🔒 Locked
            </button>
          )}
          <button
            onClick={onClose}
            className="px-5 py-3 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-2xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}