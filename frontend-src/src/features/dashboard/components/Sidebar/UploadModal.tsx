import React, { useState } from 'react';
import { Upload, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useAuth } from '../../../../shared/contexts/AuthContext';
import { useDocuments } from '../../../../shared/contexts/DocumentsContext';
import * as pdfService from '../../../../shared/services/pdfService';
import type { DocumentItem } from '../../types';
import DuplicateConfirmationModal from './DuplicateConfirmationModal';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

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

/**
 * Checks whether a PDF has enough extractable text to be processed.
 * Samples up to 3 pages and counts characters from their text content.
 * Returns an object with isTextBased flag and the page count.
 */
async function checkPDFTextContent(file: File): Promise<{ isTextBased: boolean; pageCount: number; charCount: number }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageCount = pdf.numPages;
    const pagesToSample = Math.min(3, pageCount);
    let totalChars = 0;

    for (let i = 1; i <= pagesToSample; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .trim();
      totalChars += text.length;
    }

    // Require at least 80 chars per sampled page on average
    const isTextBased = totalChars >= pagesToSample * 80;
    return { isTextBased, pageCount, charCount: totalChars };
  } catch {
    // If we can't read the PDF at all, let the server handle it
    return { isTextBased: true, pageCount: 0, charCount: 0 };
  }
}

interface UploadModalProps {
  onClose: (refreshNeeded?: boolean) => void;
}

export default function UploadModal({ onClose }: UploadModalProps) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { addDocument } = useDocuments();
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<DocumentItem | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<pdfService.DuplicateCheckResult | null>(null);

  const MAX_SIZE = 52_428_800; // 50 MB

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const performUpload = async (file: File, extracted: string | null) => {
    if (!token) {
      setError('You must be logged in to upload files.');
      return;
    }
    setIsUploading(true);
    const result = await pdfService.uploadPDF(file, token, (progress) => {
      setUploadProgress(progress);
    });
    setIsUploading(false);

    if (result.success) {
      const newDoc: DocumentItem = {
        id: Date.now(),
        filename: result.data!.filename,
        title: result.data!.originalFilename.replace(/\.pdf$/i, '').replace(/_/g, ' '),
        subtitle: 'Newly uploaded document',
        type: 'pdf',
        lastOpened: result.data!.uploadedAt ?? new Date().toISOString(),
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
      setUploadComplete(true);
      setUploadedFile(newDoc);
      setPendingFile(null);
      setDuplicateResult(null);
    } else {
      setError(result.error ?? 'Upload failed. Please try again.');
    }
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
    setUploadProgress(0);
    setFileSize(formatFileSize(file.size));

    // Check if PDF has extractable text before uploading
    setIsChecking(true);
    const textCheck = await checkPDFTextContent(file);
    setIsChecking(false);

    if (!textCheck.isTextBased) {
      setError(
        `This PDF appears to be image-based or scanned (only ${textCheck.charCount} characters detected across ${Math.min(3, textCheck.pageCount)} page${textCheck.pageCount === 1 ? '' : 's'}). ` +
        `Please upload a text-based PDF so lessons can be generated from its content.`
      );
      return;
    }

    // Extract thumbnail before uploading (fast, runs on the local file)
    const extracted = await extractPDFThumbnail(file);
    setThumbnail(extracted);

    // Check for duplicates
    setIsCheckingDuplicates(true);
    const duplicateCheckResult = await pdfService.checkForDuplicates(file, token);
    setIsCheckingDuplicates(false);

    if (!duplicateCheckResult.success) {
      console.error('Error checking duplicates:', duplicateCheckResult.error);
      // Continue with upload even if duplicate check fails
    } else if (duplicateCheckResult.isDuplicate && duplicateCheckResult.duplicates.length > 0) {
      // Show confirmation modal
      setPendingFile(file);
      setDuplicateResult(duplicateCheckResult);
      return;
    }

    // Proceed with upload
    await performUpload(file, extracted);
  };

  const handleConfirmDuplicateUpload = async () => {
    if (!pendingFile) return;
    await performUpload(pendingFile, thumbnail ?? null);
  };

  const handleCancelDuplicate = () => {
    setPendingFile(null);
    setDuplicateResult(null);
    setThumbnail(null);
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
    <>
      {duplicateResult?.isDuplicate && (
        <DuplicateConfirmationModal
          fileName={pendingFile?.name ?? 'PDF'}
          duplicates={duplicateResult.duplicates}
          onConfirm={handleConfirmDuplicateUpload}
          onCancel={handleCancelDuplicate}
          isLoading={isUploading}
        />
      )}

      {!duplicateResult?.isDuplicate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
                  {uploadComplete ? 'Upload Complete! 🎉' : 'Upload PDF'}
                </h2>
                <button
                  onClick={() => onClose(uploadComplete)}
                  disabled={isUploading || isCheckingDuplicates}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-8 py-8">
              {uploadComplete && uploadedFile ? (
                <div className="text-center space-y-6">
                  <div className="flex justify-center">
                    <CheckCircle size={64} className="text-green-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                      {uploadedFile.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {fileSize}
                    </p>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">
                    Your document has been successfully uploaded and is ready for learning!
                  </p>
                  <div className="flex gap-4 justify-center pt-4">
                    <button
                      onClick={() => {
                        onClose(true);
                        navigate('/dashboard');
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-xl font-medium transition cursor-pointer"
                    >
                      <ArrowLeft size={18} />
                      Back to Dashboard
                    </button>
                    <button
                      onClick={() => {
                        onClose(true);
                        navigate(`/roadmap/${uploadedFile.filename}`);
                      }}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition cursor-pointer" 
                    >
                      View Roadmap
                    </button>
                  </div>
                </div>
              ) : (
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

                  {fileSize && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 font-medium">
                      File size: {fileSize}
                    </p>
                  )}

                  {isUploading && (
                    <div className="mb-6 space-y-2">
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-600 h-full transition-all duration-300 ease-out"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {Math.round(uploadProgress)}% uploaded
                      </p>
                    </div>
                  )}

                  {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
                  <input
                    type="file"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-upload"
                    accept=".pdf"
                    disabled={isUploading || isCheckingDuplicates}
                  />
                  <label
                    htmlFor="file-upload"
                    className={`inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition ${
                      isUploading || isCheckingDuplicates ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                    }`}
                  >
                    Browse PDF
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}