import { useState } from 'react';
import { Calendar, X, Bell, AlertTriangle, Check } from 'lucide-react';

interface DeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (deadline: string) => void;
  currentDeadline?: string | null;
  pdfTitle: string;
  isDark: boolean;
}

const PRESET_DAYS = [
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
];

export default function DeadlineModal({
  isOpen,
  onClose,
  onSave,
  currentDeadline,
  pdfTitle,
  isDark,
}: DeadlineModalProps) {
  const [selectedDate, setSelectedDate] = useState<string>(
    currentDeadline || ''
  );
  const [showCustom, setShowCustom] = useState(!currentDeadline);

  if (!isOpen) return null;

  const existingDeadline = currentDeadline ? new Date(currentDeadline) : null;
  const isOverdue = existingDeadline && existingDeadline < new Date();

  const handlePresetClick = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString());
  };

  const handleSave = () => {
    if (selectedDate) {
      onSave(selectedDate);
      onClose();
    }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        style={{ animation: 'modalPop 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Set Deadline
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">
                {pdfTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">
          {isOverdue && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <AlertTriangle size={20} className="text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  Deadline passed!
                </p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  A penalty may have been applied to your streak.
                </p>
              </div>
            </div>
          )}

          {currentDeadline && !isOverdue && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <Bell size={20} className="text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  Current deadline set
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  {new Date(currentDeadline).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          )}

          {!showCustom && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Quick select
              </p>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_DAYS.map((preset) => (
                  <button
                    key={preset.days}
                    onClick={() => handlePresetClick(preset.days)}
                    className="px-3 py-2.5 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCustom(true)}
                className="w-full text-sm text-blue-600 dark:text-blue-400 hover:underline pt-2"
              >
                Choose custom date →
              </button>
            </div>
          )}

          {showCustom && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Custom deadline
              </label>
              <input
                type="datetime-local"
                value={selectedDate ? selectedDate.slice(0, 16) : ''}
                min={minDate}
                onChange={(e) => setSelectedDate(e.target.value ? `${e.target.value}:00.000Z` : '')}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {selectedDate && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(selectedDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedDate}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Check size={18} />
            Save Deadline
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalPop {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}