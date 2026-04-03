import { ChevronDown, User2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../shared/contexts/AuthContext';

interface UserCardProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function UserCard({ isOpen, onToggle }: UserCardProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/signin');
  };

  return (
    <div className="relative">
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-gray-800 shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-[#6f9d9c] dark:bg-teal-600 text-white grid place-items-center shrink-0">
              <User2 size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {user?.email ?? ''}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {user?.id ? `ID: ${user.id.slice(0, 8)}…` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition shrink-0 cursor-pointer"
          >
            <ChevronDown
              size={16}
              className={`text-gray-600 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 rounded-xl border border-black/10 dark:border-white/10 shadow-lg py-2 z-50">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition cursor-pointer"
            >
              Logout
            </button>
          </div>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
        </>
      )}
    </div>
  );
}
