import { AlertCircle, Download } from 'lucide-react';

interface DuplicateConfirmationModalProps {
  fileName: string;
  duplicates: Array<{ filename: string; displayName: string }>;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function DuplicateConfirmationModal({
  fileName,
  duplicates,
  onConfirm,
  onCancel,
  isLoading = false,
}: DuplicateConfirmationModalProps) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-900/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Duplicate File Detected
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                You have already uploaded a file with the same content.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6 space-y-4">
          {/* New file info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-300 uppercase tracking-wide mb-1">
              New File
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {fileName}
            </p>
          </div>

          {/* Existing duplicates */}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Existing File{duplicates.length > 1 ? 's' : ''}
            </p>
            <div className="space-y-2">
              {duplicates.map((dup, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 flex items-start gap-2"
                >
                  <Download className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {dup.displayName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {dup.filename}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Warning message */}
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-700 dark:text-red-300">
              <span className="font-semibold">Note:</span> Uploading this file will create a duplicate in your library.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-8 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" opacity="0.25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Uploading...
              </>
            ) : (
              'Upload Anyway'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
