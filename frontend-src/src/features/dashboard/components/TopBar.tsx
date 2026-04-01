import { Search, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../../shared/contexts/ThemeContext';

export default function TopBar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center justify-between mb-8">
      {/* Search Bar */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search 
            size={20} 
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" 
          />
          <input
            type="text"
            placeholder="Search here"
            className="w-full h-10 pl-10 pr-4 rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="ml-4">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {theme === 'light' ? (
            <>
              <Moon size={18} className="text-gray-700 dark:text-gray-300" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Light Mode
              </span>
            </>
          ) : (
            <>
              <Sun size={18} className="text-yellow-400" />
              <span className="text-sm font-medium text-gray-300">
                Dark Mode
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}