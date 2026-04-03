import React, { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useAuth } from '../../../../shared/contexts/AuthContext';
import { useDocuments } from '../../../../shared/contexts/DocumentsContext';
import * as pdfService from '../../../../shared/services/pdfService';
import type { DocumentItem } from '../../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

async function extractPDFThumbnail(file: File): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
}

interface UploadModalProps {
  onClose: (refreshNeeded?: boolean) => void;
}

export default function UploadModal({ onClose }: UploadModalProps) {
  const { token } = useAuth();
  const { addDocument } = useDocuments();
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  const MAX_SIZE = 52_428_800; // 50 MB

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const uploadFile = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 50 MB.`);
      return;
    }
    if (!file.name.trim()) {
      setError('File name cannot be empty.');
      return;
    }
    if (!token) {
      setError('You must be logged in to upload files.');
      return;
    }
    setError(undefined);

    // Extract thumbnail before uploading (fast, runs on the local file)
    const extracted = await extractPDFThumbnail(file);
    setThumbnail(extracted);

    setIsUploading(true);
    const result = await pdfService.uploadPDF(file, token);
    setIsUploading(false);
    if (result.success) {
      const newDoc: DocumentItem = {
        id: Date.now(),
        filename: result.data!.filename,
        title: result.data!.originalFilename.replace(/\.pdf$/i, '').replace(/_/g, ' '),
        subtitle: 'Newly uploaded document',
        type: 'pdf',
        lastOpened: new Date().toISOString().split('T')[0],
        coverImage: extracted,
        firstPageThumbnail: extracted,
        progress: {
          completedLessons: 0,
          totalLessons: 0,
          percentage: 0,
          lastAccessedAt: null,
          streakDays: 0,
        },
      };
      addDocument(newDoc);
      onClose(true);
    } else {
      setError(result.error ?? 'Upload failed. Please try again.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Upload PDF</h2>
            <button
              onClick={() => onClose(false)}
              disabled={isUploading}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition disabled:opacity-50"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

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
            {thumbnail && !isUploading ? (
              <div className="relative">
                <img
                  src={thumbnail}
                  alt="PDF preview"
                  className="mx-auto max-h-48 rounded-lg shadow-md object-contain"
                />
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-3">
                  ✓ Preview loaded — uploading…
                </p>
              </div>
            ) : isUploading ? (
              <Loader2 size={48} className="mx-auto mb-4 text-blue-500 animate-spin" />
            ) : (
              <Upload size={48} className={`mx-auto mb-4 ${dragActive ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`} />
            )}
            {!thumbnail && (
              <>
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {isUploading ? 'Uploading…' : 'Drop your PDF here'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  PDF files only · up to 50 MB
                </p>
              </>
            )}
            {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
            <input
              type="file"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
              accept=".pdf"
              disabled={isUploading}
            />
            <label
              htmlFor="file-upload"
              className={`inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition ${
                isUploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
              }`}
            >
              Browse PDF
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
