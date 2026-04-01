import React, { useState } from 'react';
import { Upload } from 'lucide-react';

interface UploadModalProps {
  onClose: () => void;
}

export default function UploadModal({ onClose }: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files?.length > 0) {
      console.log('Files dropped:', files);
      alert(`${files.length} file(s) selected. Upload functionality coming soon!`);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      console.log('Files selected:', files);
      alert(`${files.length} file(s) selected. Upload functionality coming soon!`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              Upload Files
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
            }`}
          >
            <Upload size={48} className={`mx-auto mb-4 ${dragActive ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`} />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Drop your files here
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              PDF, images, docs, audio, and more
            </p>

            <input
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
            />
            <label
              htmlFor="file-upload"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium cursor-pointer transition"
            >
              Browse Files
            </label>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4">
            {['Websites', 'Drive', 'Copied text'].map((label, idx) => (
              <button
                key={label}
                type="button"
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition text-center"
              >
                <div className={`mb-2 ${idx === 0 ? 'text-red-500' : idx === 1 ? 'text-green-500' : 'text-blue-500'}`}>
                  <svg className="w-6 h-6 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}