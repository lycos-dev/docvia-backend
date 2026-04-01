export default function StreakCard() {
  const currentStreak = 7;
  const longestStreak = 15;
  const todayCompleted = true;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm transition-colors">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <span className="text-2xl">🔥</span>
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Your Streak</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Keep it going!</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Streak</span>
          <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{currentStreak} days</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Longest Streak</span>
          <span className="text-2xl font-bold text-gray-600 dark:text-gray-400">{longestStreak} days</span>
        </div>

        <div className={`p-4 rounded-2xl ${todayCompleted ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
          <p className={`text-sm font-medium text-center ${todayCompleted ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
            {todayCompleted ? '✅ Today completed!' : '⏳ Complete today\'s reading'}
          </p>
        </div>
      </div>
    </div>
  );
}