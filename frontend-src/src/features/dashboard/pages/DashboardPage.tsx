// src/features/dashboard/pages/DashboardPage.tsx

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import TopBar from '../components/TopBar';
import WelcomeBanner from '../components/WelcomeBanner';
import ReadingSection from '../components/ReadingSection';
import StreakCard from '../components/StreakCard';
import DeadlineBanner from '../components/DeadlineBanner';
import { useProgressContext } from '../../../shared/contexts/ProgressContext';
import { useDocuments } from '../../../shared/contexts/DocumentsContext';

// ─── Streak Lost Modal ────────────────────────────────────────────────────────

interface StreakLostModalProps {
  longestStreak: number;
  onClose: () => void;
}

function StreakLostModal({ longestStreak, onClose }: StreakLostModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        key="streak-lost-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      >
        <motion.div
          key="streak-lost-card"
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 6 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white dark:bg-[#1e293b] rounded-3xl p-7 shadow-2xl border border-gray-100 dark:border-white/10 max-w-xs w-full text-center"
          style={{ fontFamily: 'Poppins, sans-serif' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Flame icon (desaturated to signal loss) */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <span className="text-3xl grayscale opacity-60">🔥</span>
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
            Streak Lost
          </h2>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 leading-relaxed">
            You missed a day and your streak has ended.
          </p>

          {longestStreak > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
              Your best was{' '}
              <span className="font-semibold text-amber-500 dark:text-amber-400">
                {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
              </span>
              . Start fresh today!
            </p>
          )}

          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-[#89ADE2] hover:bg-[#6B93D1] text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Okay
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const { streak, acknowledgeStreakLost, documentProgress } = useProgressContext();
  const { documents } = useDocuments();

  // Show the modal automatically when the user loads the dashboard and
  // their streak was just detected as lost (streakJustLost flag from ProgressContext).
  const [modalDismissed, setModalDismissed] = useState(false);
  const showStreakLostModal = streak.streakJustLost && !modalDismissed;

  function handleCloseStreakModal() {
    setModalDismissed(true);
    acknowledgeStreakLost(); // clears the flag in storage so it won't re-appear next session
  }

  // Only show banners for documents that actually have a deadline set
  const docsWithDeadline = documents.filter(
    (doc) => documentProgress[doc.filename]?.deadline != null
  );

  return (
    <div>
      <TopBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <WelcomeBanner />

          {/* Deadline banners moved to the right column under the streak calendar */}

          <ReadingSection searchTerm={searchTerm} onSearchClear={() => setSearchTerm('')} />
        </div>
        <div className="w-full xl:w-[320px] flex xl:block justify-end">
          <StreakCard />
        </div>
      </div>

      {/* Streak lost modal — shown automatically on login if streak was lost */}
      {showStreakLostModal && (
        <StreakLostModal
          longestStreak={streak.longestStreak}
          onClose={handleCloseStreakModal}
        />
      )}
    </div>
  );
}