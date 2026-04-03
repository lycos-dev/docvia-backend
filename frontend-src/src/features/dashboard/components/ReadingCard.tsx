import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { DocumentItem } from "../types";
import { cn } from "../../../shared/utils/cn";
import { useDocuments } from "../../../shared/contexts/DocumentsContext";

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(document.title);
  const [titleError, setTitleError] = useState<string | null>(null);

  const { progress } = document;

  const handleCardClick = () => {
    if (!isEditingTitle) {
      // FIX: use filename (backend storage key) not numeric id
      // TODO (backend): if lessons become per-user, switch back to document.id
      // and update the backend to scope lesson records by userId
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${document.title}"?`)) {
      removeDocument(document.filename);
    }
    setMenuOpen(false);
  };

  /** Renders the progress status line below the title */
  function ProgressStatus() {
    if (!progress || progress.totalLessons === 0) {
      return (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
          {document.subtitle}
        </p>
      );
    }
    if (progress.percentage === 100) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium mt-1">
          ✓ Completed
        </span>
      );
    }
    if (progress.percentage === 0) {
      return (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Not started
        </p>
      );
    }
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
      <div className="relative">
        <div
          onClick={handleCardClick}
          className="overflow-hidden rounded-3xl border border-[#d8d8d8] dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_14px_40px_rgba(0,0,0,0.4)] cursor-pointer"
        >
          {/* Image Container */}
          <div className="relative w-full h-40 bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 overflow-hidden">
            {document.coverImage ? (
              <img
                src={document.coverImage}
                alt={document.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <svg
                    className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-2"
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

          {/* Content */}
          <div className="p-4 flex justify-between items-start">
            <div className="flex-1 min-w-0 pr-2">
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
                      className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-200 truncate">
                    {document.title}
                  </h4>
                  <ProgressStatus />
                  <LastAccessed />
                </>
              )}
            </div>

            {/* Menu Button */}
            {!isEditingTitle && (
              <button
                onClick={handleMenuClick}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative z-10"
              >
                <MoreVertical
                  size={18}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                />
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Menu - Outside card to prevent clipping */}
        {menuOpen && !isEditingTitle && (
          <>
            <div className="absolute right-4 top-50 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
              <button
                onClick={handleCardClick}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Open
              </button>
              <button
                onClick={handleEditTitle}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Pencil size={16} />
                Edit Title
              </button>
              <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>

            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
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
      <div
        onClick={handleCardClick}
        className="overflow-hidden rounded-3xl border border-[#d8d8d8] dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md transition-all duration-300 hover:shadow-[0_14px_40px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_14px_40px_rgba(0,0,0,0.4)] cursor-pointer flex items-center"
      >
        {/* Image Container - List View */}
        <div className="relative w-32 h-24 bg-linear-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 shrink-0 overflow-hidden">
          {document.coverImage ? (
            <img
              src={document.coverImage}
              alt={document.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
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

        {/* Content */}
        <div className="flex-1 p-4 flex justify-between items-center">
          <div className="flex-1 min-w-0 pr-4">
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
                    className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h4 className="font-semibold text-gray-700 dark:text-gray-200 truncate">
                  {document.title}
                </h4>
                <ProgressStatus />
                <LastAccessed />
              </>
            )}
          </div>

          {/* Menu Button */}
          {!isEditingTitle && (
            <button
              onClick={handleMenuClick}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors relative z-10"
            >
              <MoreVertical
                size={18}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Menu - Outside card */}
      {menuOpen && !isEditingTitle && (
        <>
          <div className="absolute right-4 top-1/2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
            <button
              onClick={handleCardClick}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Open
            </button>
            <button
              onClick={handleEditTitle}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <Pencil size={16} />
              Edit Title
            </button>
            <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>

          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
        </>
      )}
    </div>
  );
}
