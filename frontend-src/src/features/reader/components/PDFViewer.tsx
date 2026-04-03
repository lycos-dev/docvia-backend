// src/features/reader/components/PDFViewer.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PDFViewerProps {
  documentId: string;
  initialPage?: number;
  isDark: boolean;
  token?: string; // required by backend /api/pdf/file/:id auth check
}

export default function PDFViewer({ documentId, initialPage = 1, isDark, token }: PDFViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState<string>(String(initialPage));

  // Load PDF on mount / when documentId changes
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setPdfDoc(null);
    setTotalPages(0);

    const url = `/api/pdf/file/${documentId}`;
    pdfjsLib
      .getDocument({ url, httpHeaders: token ? { Authorization: `Bearer ${token}` } : {} })
      .promise.then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
        setPageInput('1');
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load PDF. Make sure you\'re logged in.');
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [documentId]);

  // Render current page whenever pdfDoc, currentPage, or scale changes
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const task = page.render({ canvasContext: ctx, canvas, viewport });
      renderTaskRef.current = task;
      await task.promise;
      renderTaskRef.current = null;
    } catch (err) {
      // Ignore cancelled renders
      if ((err as { name?: string })?.name === 'RenderingCancelledException') return;
    }
  }, [pdfDoc, currentPage, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  // Page navigation helpers
  const goToPrevPage = () => {
    if (currentPage > 1) {
      const next = currentPage - 1;
      setCurrentPage(next);
      setPageInput(String(next));
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      const next = currentPage + 1;
      setCurrentPage(next);
      setPageInput(String(next));
    }
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputBlur = () => {
    const parsed = parseInt(pageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      setCurrentPage(parsed);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageInputBlur();
    }
  };

  // Zoom helpers (clamp between 0.5 and 2.0)
  const zoomOut = () => setScale((s) => Math.max(0.5, parseFloat((s - 0.1).toFixed(1))));
  const zoomIn = () => setScale((s) => Math.min(2.0, parseFloat((s + 0.1).toFixed(1))));

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Scrollable PDF area */}
      <div
        className={cn(
          'flex-1 overflow-auto flex items-start justify-center py-4 px-4',
          'bg-gray-100 dark:bg-[#0f172a]',
        )}
      >
        {isLoading && (
          <div className="w-full max-w-2xl mt-8">
            <div className="animate-pulse bg-gray-300 dark:bg-gray-700 rounded-lg w-full h-[70vh]" />
            <div className="animate-pulse bg-gray-200 dark:bg-gray-800 rounded mt-3 w-1/3 h-4 mx-auto" />
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center mt-20 text-center px-4">
            <div className="text-4xl mb-4">📄</div>
            <p className="text-[#111827] dark:text-[#F1F5F9] font-medium text-base mb-2">
              Could not load PDF
            </p>
            <p className="text-[#6B7280] dark:text-[#94A3B8] text-sm max-w-xs">
              {error}
            </p>
          </div>
        )}

        {!isLoading && !error && (
          <canvas
            ref={canvasRef}
            className={cn(
              'shadow-xl rounded border',
              isDark ? 'border-gray-700' : 'border-gray-200',
            )}
            style={{ maxWidth: '100%' }}
          />
        )}
      </div>

      {/* Controls bar */}
      <div
        className={cn(
          'shrink-0 h-12 flex items-center justify-center gap-3 px-4',
          'bg-white dark:bg-[#1e293b]',
          'border-t border-black/10 dark:border-white/10',
        )}
      >
        {/* Page controls */}
        <button
          onClick={goToPrevPage}
          disabled={currentPage <= 1 || isLoading}
          className={cn(
            'p-1 rounded transition-colors',
            currentPage > 1 && !isLoading
              ? 'text-[#6B7280] dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-white/10'
              : 'text-gray-300 dark:text-white/20 cursor-not-allowed',
          )}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="flex items-center gap-1.5 text-sm text-[#6B7280] dark:text-[#94A3B8]">
          <span>Page</span>
          <input
            type="text"
            value={pageInput}
            onChange={handlePageInputChange}
            onBlur={handlePageInputBlur}
            onKeyDown={handlePageInputKeyDown}
            disabled={isLoading || totalPages === 0}
            className={cn(
              'w-10 text-center rounded border px-1 py-0.5 text-sm font-medium',
              'bg-gray-50 dark:bg-[#0f172a]',
              'border-black/10 dark:border-white/10',
              'text-[#111827] dark:text-[#F1F5F9]',
              'focus:outline-none focus:ring-1 focus:ring-[#3B82F6]',
              'disabled:opacity-50',
            )}
          />
          <span>of {totalPages || '—'}</span>
        </span>

        <button
          onClick={goToNextPage}
          disabled={currentPage >= totalPages || isLoading}
          className={cn(
            'p-1 rounded transition-colors',
            currentPage < totalPages && !isLoading
              ? 'text-[#6B7280] dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-white/10'
              : 'text-gray-300 dark:text-white/20 cursor-not-allowed',
          )}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>

        {/* Divider */}
        <div className="w-px h-4 bg-black/10 dark:bg-white/10" />

        {/* Zoom controls */}
        <button
          onClick={zoomOut}
          disabled={scale <= 0.5}
          className={cn(
            'p-1 rounded transition-colors',
            scale > 0.5
              ? 'text-[#6B7280] dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-white/10'
              : 'text-gray-300 dark:text-white/20 cursor-not-allowed',
          )}
          aria-label="Zoom out"
        >
          <ZoomOut size={16} />
        </button>

        <span className="text-sm font-medium text-[#6B7280] dark:text-[#94A3B8] w-12 text-center">
          {Math.round(scale * 100)}%
        </span>

        <button
          onClick={zoomIn}
          disabled={scale >= 2.0}
          className={cn(
            'p-1 rounded transition-colors',
            scale < 2.0
              ? 'text-[#6B7280] dark:text-[#94A3B8] hover:bg-gray-100 dark:hover:bg-white/10'
              : 'text-gray-300 dark:text-white/20 cursor-not-allowed',
          )}
          aria-label="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
      </div>
    </div>
  );
}
