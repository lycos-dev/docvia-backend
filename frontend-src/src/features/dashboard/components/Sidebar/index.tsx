import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, Home, FileText, Settings, Upload, Map } from 'lucide-react'; // Added Map icon
import NavItem from './NavItem';
import FileRow from './FileRow';
import UserCard from './UserCard';
import UploadModal from './UploadModal';
import type { UploadedFile } from '../../types/sidebar.types';

const MOCK_FILES: UploadedFile[] = [
  { id: 'f1', name: 'Aish Shibal', uploadedAt: '2026-02-10', type: 'pdf', sizeLabel: '1.2 MB' },
  { id: 'f2', name: 'Research Draft', uploadedAt: '2026-02-18', type: 'docx', sizeLabel: '340 KB' },
  { id: 'f3', name: 'Meeting Summary', uploadedAt: '2026-01-27', type: 'txt', sizeLabel: '18 KB' },
  { id: 'f4', name: 'Design System', uploadedAt: '2026-02-15', type: 'pdf', sizeLabel: '2.1 MB' },
];

interface SidebarProps {
  uploadedFiles?: UploadedFile[];
  onFileSelect?: (fileId: string) => void;
}

export default function Sidebar({ uploadedFiles = MOCK_FILES, onFileSelect }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navItems = [
    { icon: <Home size={16} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Map size={16} />, label: 'Roadmap', path: '/roadmap' }, // ← NEW
    { icon: <FileText size={16} />, label: 'Progress', path: '/progress' },
    { icon: <Settings size={16} />, label: 'Settings', path: '/settings' },
  ];

  return (
    <>
      <aside className="w-64 shrink-0 bg-white dark:bg-gray-900 border-r border-black/10 dark:border-white/10 h-screen flex flex-col fixed left-0 top-0 transition-colors">
        {/* Top Section */}
        <div className="shrink-0 px-5 pt-6 pb-4">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl overflow-hidden">
              <img src="/logo.png" alt="Docvia" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-bold text-gray-600 dark:text-gray-300">Docvia</span>
          </div>

          {/* Upload Button */}
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

          {/* Nav */}
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

          {/* File Browser Header */}
          <button
            type="button"
            onClick={() => setIsFileBrowserOpen((v) => !v)}
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <ChevronRight size={16} className={`transition-transform ${isFileBrowserOpen ? 'rotate-90' : ''}`} />
            <span className="font-medium">File Browser</span>
          </button>
        </div>

        {/* Scrollable File List */}
        {isFileBrowserOpen && (
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="space-y-1">
              {uploadedFiles.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2">No files uploaded yet</p>
              ) : (
                <ul className="space-y-1">
                  {uploadedFiles.map((file) => (
                    <FileRow key={file.id} file={file} onClick={() => onFileSelect?.(file.id)} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {!isFileBrowserOpen && <div className="flex-1" />}

        {/* Fixed User Card */}
        <div className="shrink-0 px-5 py-4 border-t border-black/10 dark:border-white/10">
          <UserCard isOpen={userMenuOpen} onToggle={() => setUserMenuOpen(!userMenuOpen)} />
        </div>
      </aside>

      {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} />}
    </>
  );
}