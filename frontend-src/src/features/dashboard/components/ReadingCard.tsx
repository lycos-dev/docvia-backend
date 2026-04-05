import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { DocumentItem } from "../types";
import { cn } from "../../../shared/utils/cn";
import { useDocuments } from "../../../shared/contexts/DocumentsContext";
import { useAuth } from "../../../shared/contexts/AuthContext";
import { deletePDF } from "../../../shared/services/pdfService";

// Set worker once per module load (same as UploadModal)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface ReadingCardProps {
  document: DocumentItem;
  viewMode: "grid" | "list";
}

function daysAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return "Last opened today";
  if (diff === 1) return "Last opened yesterday";
  return `Last opened ${diff} days ago`;
}

export default function ReadingCard({ document, viewMode }: ReadingCardProps) {
  const navigate = useNavigate();
  const { removeDocument, updateDocument } = useDocuments();
  const { token } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(document.title);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuFixedStyle, setMenuFixedStyle] = useState<React.CSSProperties | null>(null);

  // Thumbnail: use cached coverImage if available, otherwise fetch first PDF page via pdfjs
  const [thumbnailSrc, setThumbnailSrc] = useState<string | null>(document.coverImage ?? null);

  useEffect(() => {
    setEditedTitle(document.title);
  }, [document.title]);

  useEffect(() => {
    if (document.coverImage) {
      setThumbnailSrc(document.coverImage);
      return;
    }
    if (!token || !document.filename) return;
    let cancelled = false;
    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument({
          url: `/api/pdf/file/${encodeURIComponent(document.filename)}`,
          httpHeaders: { Authorization: `Bearer ${token}` },
        }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = window.document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (!ctx || cancelled) return;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) setThumbnailSrc(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        // no-op — "No preview" placeholder remains if fetch fails
      }
    })();
    return () => { cancelled = true; };
  }, [document.filename, document.coverImage, token]);

  const updateMenuPosition = useCallback(() => {
    const btn = menuButtonRef.current;
    const panel = menuPanelRef.current;
    if (!btn || !panel) return;
    const br = btn.getBoundingClientRect();
    const pad = 8;
    const gap = 6;
    const mh = panel.offsetHeight;
    const mw = panel.offsetWidth;
    const spaceBelow = window.innerHeight - br.bottom - gap;
    const spaceAbove = br.top - gap;
    const placeBelow = spaceBelow >= mh || spaceBelow >= spaceAbove;

    let top: number;
    if (placeBelow) {
      top = br.bottom + gap;
      if (top + mh > window.innerHeight - pad) {
        top = Math.max(pad, window.innerHeight - pad - mh);
      }
    } else {
      top = br.top - gap - mh;
      if (top < pad) top = pad;
    }

    let left = br.right - mw;
    if (left < pad) left = pad;
    if (left + mw > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - pad - mw);
    }

    setMenuFixedStyle({
      position: "fixed",
      top,
      left,
      zIndex: 100,
    });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuFixedStyle(null);
      return;
    }
    updateMenuPosition();
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(updateMenuPosition);
    });
    const onResize = () => updateMenuPosition();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [menuOpen, updateMenuPosition]);

  const { progress } = document;

  const handleCardClick = () => {
    if (!isEditingTitle) {
      // Use filename (backend storage key) — not numeric id
      navigate(`/roadmap/${encodeURIComponent(document.filename)}`);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const handleEditTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
    setMenuOpen(false);
  };

  const handleSaveTitle = () => {
    const trimmed = editedTitle.trim();
    if (trimmed.length < 1) {
      setTitleError('Title cannot be empty.');
      return;
    }
    if (trimmed.length > 100) {
      setTitleError('Title must be 100 characters or fewer.');
      return;
    }
    if (editedTitle !== trimmed) {
      setTitleError('Title cannot have leading or trailing spaces.');
      return;
    }
    setTitleError(null);
    updateDocument(document.filename, { title: trimmed });
    setIsEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setEditedTitle(document.title);
    setTitleError(null);
    setIsEditingTitle(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);

    if (!window.confirm(`Are you sure you want to delete "${document.title}"?`)) return;

    setIsDeleting(true);

    // Optimistically remove from UI immediately so it feels instant
    removeDocument(document.filename);

    // Delete from Supabase storage via the backend
    if (token) {
      const result = await deletePDF(document.filename, token);
      if (!result.success) {
        // If the backend call failed, log it — the file will reappear on next
        // refresh, but we don't want to block the user with an error modal here.
        console.error('[Delete] Backend deletion failed for', document.filename);
      }
    }

    setIsDeleting(false);
  };

  /** Renders the progress status line below the title — fixed block height keeps cards aligned */
  function ProgressStatus() {
    if (!progress || progress.totalLessons === 0) {
      return (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2.5rem] leading-snug">
          {document.subtitle.trim() ? document.subtitle : 'Open the roadmap to start learning'}
        </p>
      );
    }
    if (progress.percentage === 100) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium min-h-[2.5rem] self-start">
          ✓ Completed
        </span>
      );
    }
    if (progress.percentage === 0) {
      return (
        <p className="text-xs text-gray-500 dark:text-gray-400 min-h-[2.5rem] leading-snug flex items-center">
          Not started
        </p>
      );
    }
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 min-h-[2.5rem] leading-snug flex items-center">
        {progress.completedLessons} of {progress.totalLessons} lessons · {progress.percentage}%
      </p>
    );
  }

  /** Renders the "last opened" line */
  function LastAccessed() {
    if (!progress?.lastAccessedAt) return null;
    return (
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
        {daysAgo(progress.lastAccessedAt)}
      </p>
    );
  }

  /** Progress bar overlay — sits at bottom of the image container */
  function ProgressBar() {
    if (!progress || progress.totalLessons === 0) return null;
    return (
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200/60 dark:bg-gray-700/60">
        <div
          className="h-full bg-gradient-to-r from-[#3B82F6] to-[#6366F1] transition-all duration-300"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
    );
  }

  // Grid View
  if (viewMode === "grid") {
    return (
      <div className="relative h-full flex flex-col">
        <motion.div
          onClick={handleCardClick}
          whileHover={{ y: -4, transition: { type: 'spring', stiffness: 420, damping: 28 } }}
          whileTap={{ scale: 0.99 }}
          className={cn(
            "overflow-hidden rounded-3xl border border-[#d8d8d8] dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md transition-shadow duration-300 hover:shadow-[0_14px_40px_rgba(0,0,0,0.14)] dark:hover:shadow-[0_14px_40px_rgba(0,0,0,0.35)] cursor-pointer h-full flex flex-col",
            isDeleting && "opacity-50 pointer-events-none"
          )}
        >
          {/* Image — fixed aspect so every card lines up */}
          <div className="relative w-full aspect-[16/10] shrink-0 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
            {thumbnailSrc ? (
              <img
                src={thumbnailSrc}
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center px-2">
                  <svg
                    className="w-14 h-14 mx-auto text-gray-400 dark:text-gray-600 mb-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-xs text-gray-500 dark:text-gray-400">No preview</p>
                </div>
              </div>
            )}
            <ProgressBar />
          </div>

          {/* Content — separated from thumbnail so titles stay readable on white PDFs */}
          <div className="p-4 flex justify-between items-stretch gap-2 flex-1 min-h-0 border-t border-gray-200/90 dark:border-gray-600 bg-slate-50 dark:bg-slate-900/90 shadow-[0_-6px_16px_rgba(15,23,42,0.08)] dark:shadow-[0_-6px_20px_rgba(0,0,0,0.35)]">
            <div className="flex-1 min-w-0 flex flex-col">
              {isEditingTitle ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => { setEditedTitle(e.target.value); setTitleError(null); }}
                    className={cn(
                      "w-full px-2 py-1 text-sm font-semibold border rounded focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-gray-200",
                      titleError
                        ? "border-red-500 focus:ring-red-500"
                        : "border-blue-500 focus:ring-blue-500"
                    )}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                  />
                  {titleError && (
                    <p className="text-xs text-red-500 mt-1">{titleError}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleSaveTitle}
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 min-h-[2.75rem] leading-snug">
                    {document.title}
                  </h4>
                  <div className="mt-1 flex-1 flex flex-col gap-0.5">
                    <ProgressStatus />
                    <LastAccessed />
                  </div>
                </>
              )}
            </div>

            {/* Menu Button */}
            {!isEditingTitle && (
              <button
                ref={menuButtonRef}
                type="button"
                onClick={handleMenuClick}
                className="p-1.5 h-9 w-9 shrink-0 rounded-lg hover:bg-white/80 dark:hover:bg-slate-800 transition-colors relative z-10 cursor-pointer self-start"
              >
                <MoreVertical
                  size={18}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                />
              </button>
            )}
          </div>
        </motion.div>

        {/* Fixed menu: stays in viewport; opens upward when needed */}
        {menuOpen && !isEditingTitle && (
          <>
            <div
              ref={menuPanelRef}
              style={menuFixedStyle ?? { position: "fixed", visibility: "hidden", top: 0, left: 0 }}
              className="z-100 w-48 max-h-[min(70vh,calc(100dvh-16px))] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1 shadow-xl"
            >
              <button
                type="button"
                onClick={handleCardClick}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Open
              </button>
              <button
                type="button"
                onClick={handleEditTitle}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Pencil size={16} className="shrink-0" />
                Edit Title
              </button>
              <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
              <button
                type="button"
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Trash2 size={16} className="shrink-0" />
                Delete
              </button>
            </div>

            <div
              className="fixed inset-0 z-[90]"
              aria-hidden
              onClick={() => setMenuOpen(false)}
            />
          </>
        )}
      </div>
    );
  }

  // List View
  return (
    <div className="relative">
      <motion.div
        onClick={handleCardClick}
        whileHover={{ x: 2, transition: { type: 'spring', stiffness: 400, damping: 30 } }}
        whileTap={{ scale: 0.995 }}
        className={cn(
          "overflow-hidden rounded-3xl border border-[#d8d8d8] dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md transition-shadow duration-300 hover:shadow-[0_10px_32px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_10px_32px_rgba(0,0,0,0.35)] cursor-pointer flex items-stretch min-h-[6.5rem]",
          isDeleting && "opacity-50 pointer-events-none"
        )}
      >
        {/* Thumbnail — same source as grid (cover or pdf.js) */}
        <div className="relative w-32 sm:w-36 shrink-0 self-stretch min-h-[6.5rem] bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-gray-400 dark:text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
          <ProgressBar />
        </div>

        {/* Content — contrast strip beside thumbnail */}
        <div className="flex-1 p-4 flex justify-between items-start gap-3 min-w-0 border-l border-gray-200/90 dark:border-gray-600 bg-slate-50 dark:bg-slate-900/90">
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {isEditingTitle ? (
              <div onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => { setEditedTitle(e.target.value); setTitleError(null); }}
                  className={cn(
                    "w-full px-2 py-1 text-sm font-semibold border rounded focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-gray-200",
                    titleError
                      ? "border-red-500 focus:ring-red-500"
                      : "border-blue-500 focus:ring-blue-500"
                  )}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                />
                {titleError && (
                  <p className="text-xs text-red-500 mt-1">{titleError}</p>
                )}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleSaveTitle}
                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
                  {document.title}
                </h4>
                <div className="mt-1">
                  <ProgressStatus />
                  <LastAccessed />
                </div>
              </>
            )}
          </div>

          {/* Menu Button */}
          {!isEditingTitle && (
            <button
              ref={menuButtonRef}
              type="button"
              onClick={handleMenuClick}
              className="p-1.5 h-9 w-9 shrink-0 rounded-lg hover:bg-white/80 dark:hover:bg-slate-800 transition-colors relative z-10 cursor-pointer"
            >
              <MoreVertical
                size={18}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              />
            </button>
          )}
        </div>
      </motion.div>

      {menuOpen && !isEditingTitle && (
        <>
          <div
            ref={menuPanelRef}
            style={menuFixedStyle ?? { position: "fixed", visibility: "hidden", top: 0, left: 0 }}
            className="z-[100] w-48 max-h-[min(70vh,calc(100dvh-16px))] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 py-1 shadow-xl"
          >
            <button
              type="button"
              onClick={handleCardClick}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Open
            </button>
            <button
              type="button"
              onClick={handleEditTitle}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Pencil size={16} className="shrink-0" />
              Edit Title
            </button>
            <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
            <button
              type="button"
              onClick={handleDelete}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Trash2 size={16} className="shrink-0" />
              Delete
            </button>
          </div>

          <div
            className="fixed inset-0 z-[90]"
            aria-hidden
            onClick={() => setMenuOpen(false)}
          />
        </>
      )}
    </div>
  );
}