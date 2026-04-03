import { FileText } from 'lucide-react';
import type { UploadedFile } from '../../types/sidebar.types';

interface FileRowProps {
  file: UploadedFile;
  onClick?: () => void;
}

export default function FileRow({ file, onClick }: FileRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-xl px-3 py-2 flex items-center gap-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
      >
        <FileText size={16} className="text-gray-600 dark:text-gray-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{file.name}</p>
        </div>
      </button>
    </li>
  );
}