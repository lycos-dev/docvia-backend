import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, Home, FileText, Settings, Upload } from 'lucide-react';
import NavItem from './NavItem';
import FileRow from './FileRow';
import UserCard from './UserCard';
import UploadModal from './UploadModal';
import { useDocuments } from '../../../../shared/contexts/DocumentsContext';
import type { UploadedFile } from '../../types/sidebar.types';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { documents } = useDocuments();
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navItems = [
    { icon: <Home size={16} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <FileText size={16} />, label: 'Progress', path: '/progress' },
    { icon: <Settings size={16} />, label: 'Settings', path: '/settings' },
  ];

  const files: UploadedFile[] = documents.map((doc) => ({
    id: String(doc.id),
    filename: doc.filename,
    name: doc.title,
    uploadedAt: doc.lastOpened,
    sizeLabel: '',
    type: 'pdf' as const,
  }));

  const handleUploadClose = () => {
    setIsUploadModalOpen(false);
  };

  const handleFileClick = (file: UploadedFile) => {
    // FIX: use filename (backend storage key) not numeric id
    // TODO (backend): if lessons become per-user, switch back to file.id
    // and update the backend to scope lesson records by userId
    navigate(`/roadmap/${encodeURIComponent(file.filename)}`);
  };

  return (
    <>
      <aside className="w-64 shrink-0 bg-white dark:bg-gray-900 border-r border-black/10 dark:border-white/10 h-screen flex flex-col fixed left-0 top-0 transition-colors">
        <div className="shrink-0 px-5 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl overflow-hidden">
              <img src="/logo.png" alt="Docvia" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-bold text-gray-600 dark:text-gray-300">Docvia</span>
          </div>

          <div className="mb-5">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="w-full h-10 rounded-xl bg-[#2f7df6] dark:bg-blue-600 text-white flex items-center justify-center gap-2 text-sm font-medium shadow-sm hover:bg-[#2567cc] dark:hover:bg-blue-700 transition"
            >
              <Upload size={16} />
              Upload File
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                active={location.pathname === item.path}
                onClick={() => navigate(item.path)}
              />
            ))}
          </nav>

          <div className="my-6 h-px w-full bg-black/10 dark:bg-white/10" />

          <button
            type="button"
            onClick={() => setIsFileBrowserOpen((v) => !v)}
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <ChevronRight
              size={16}
              className={`transition-transform ${isFileBrowserOpen ? 'rotate-90' : ''}`}
            />
            <span className="font-medium">File Browser</span>
          </button>
        </div>

        {isFileBrowserOpen && (
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="space-y-1">
              {files.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2">
                  No PDFs uploaded yet
                </p>
              ) : (
                <ul className="space-y-1">
                  {files.map((file) => (
                    <FileRow key={file.id} file={file} onClick={() => handleFileClick(file)} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {!isFileBrowserOpen && <div className="flex-1" />}

        <div className="shrink-0 px-5 py-4 border-t border-black/10 dark:border-white/10">
          <UserCard isOpen={userMenuOpen} onToggle={() => setUserMenuOpen(!userMenuOpen)} />
        </div>
      </aside>

      {isUploadModalOpen && <UploadModal onClose={handleUploadClose} />}
    </>
  );
}
