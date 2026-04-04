import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, Grid2X2, List, Upload } from 'lucide-react';
import ReadingCard from './ReadingCard';
import type { SortMode } from '../types';
import { compareDocuments } from '../utils/documentSort';
import { useDocuments } from '../../../shared/contexts/DocumentsContext';

// Mock data was here for mocking — replaced by DocumentsContext (Task 13 wiring)

interface ReadingSectionProps {
  searchTerm: string;
  onSearchClear: () => void;
}

export default function ReadingSection({ searchTerm, onSearchClear }: ReadingSectionProps) {
  const { documents, isLoading } = useDocuments();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  // 300 ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredAndSortedDocuments = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return documents
      .filter((doc) => {
        if (q.length < 1) return true;
        return (
          doc.title.toLowerCase().includes(q) ||
          doc.subtitle.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => compareDocuments(a, b, sortMode));
  }, [documents, sortMode, debouncedSearch]);

  const getSortLabel = () =>
    ({
      recent: 'Oldest',
      oldest: 'Most Recent',
      'a-z': 'Title A–Z',
      'z-a': 'Title Z–A',
    }[sortMode] ?? 'Oldest');

  const isFiltered = debouncedSearch.length >= 1;
  const total = documents.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading your documents…</p>
      </div>
    );
  }

  if (!isLoading && documents.length === 0 && !isFiltered) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Upload size={40} className="text-gray-300 dark:text-gray-600" />
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          No documents yet. Upload a PDF to get started!
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Your Reading Documents 📁
          </h3>
          {isFiltered && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Showing {filteredAndSortedDocuments.length} of {total}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-sm items-center justify-end">
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setSortDropdownOpen(!sortDropdownOpen);
              }}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1 cursor-pointer"
            >
              {getSortLabel()}
              <ChevronDown size={14} className={`transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortDropdownOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                {(['oldest', 'recent', 'a-z', 'z-a'] as SortMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setSortMode(mode);
                      setSortDropdownOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    {{ recent: 'Oldest (upload date)', oldest: 'Most Recent (upload date)', 'a-z': 'Title A–Z', 'z-a': 'Title Z–A' }[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Mode */}
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setViewMode('grid')}
              className={`p-2 rounded-full transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              aria-label="Grid view">
              <Grid2X2 size={18} />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-2 rounded-full transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              aria-label="List view">
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      <div
        className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch'
            : 'flex flex-col gap-4'
        }
      >
        {filteredAndSortedDocuments.map((doc) => (
          <div key={doc.id} className={viewMode === 'grid' ? 'h-full min-h-0' : undefined}>
            <ReadingCard document={doc} viewMode={viewMode} />
          </div>
        ))}
      </div>

      {filteredAndSortedDocuments.length === 0 && (
        <div className="mt-8 text-center">
          {isFiltered ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                No results for "{debouncedSearch}"
              </p>
              <button
                onClick={onSearchClear}
                className="text-sm text-primary hover:text-primary-dark transition-colors font-medium cursor-pointer"
              >
                Clear search
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No documents matched your search.
            </p>
          )}
        </div>
      )}

      {sortDropdownOpen && (
        <div
          className="fixed inset-0 z-[5]"
          aria-hidden
          onClick={() => setSortDropdownOpen(false)}
        />
      )}
    </div>
  );
}
