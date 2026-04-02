import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, Grid2X2, List } from 'lucide-react';
import ReadingCard from './ReadingCard';
import type { DocumentItem, SortMode, TypeFilter } from '../types';

// Mock data — preserved until DocumentsContext wires in (Batch B)
const mockDocuments: DocumentItem[] = [
  { id: 1, filename: 'testing-techniques.pdf', title: 'Testing Techniques', subtitle: 'Testing techniques in test case development', type: 'book', lastOpened: '2026-02-10', coverImage: '/assets/images/testing.png', firstPageThumbnail: null, progress: { completedLessons: 0, totalLessons: 0, percentage: 0, lastAccessedAt: null, streakDays: 0 } },
  { id: 2, filename: 'research-draft.pdf', title: 'Research Draft', subtitle: 'Reading preview text', type: 'report', lastOpened: '2026-02-18', coverImage: '/assets/images/research.jpg', firstPageThumbnail: null, progress: { completedLessons: 0, totalLessons: 0, percentage: 0, lastAccessedAt: null, streakDays: 0 } },
  { id: 3, filename: 'meeting-summary.pdf', title: 'Meeting Summary', subtitle: 'Sprint call highlights', type: 'report', lastOpened: '2026-01-27', coverImage: '/assets/images/meeting.jpg', firstPageThumbnail: null, progress: { completedLessons: 0, totalLessons: 0, percentage: 0, lastAccessedAt: null, streakDays: 0 } },
  { id: 4, filename: 'design-system.pdf', title: 'Design System', subtitle: 'Component library documentation', type: 'book', lastOpened: '2026-02-15', coverImage: '/assets/images/design.png', firstPageThumbnail: null, progress: { completedLessons: 0, totalLessons: 0, percentage: 0, lastAccessedAt: null, streakDays: 0 } },
];

interface ReadingSectionProps {
  searchTerm: string;
  onSearchClear: () => void;
}

export default function ReadingSection({ searchTerm, onSearchClear }: ReadingSectionProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  // 300 ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredAndSortedDocuments = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return mockDocuments
      .filter((doc) => {
        if (typeFilter !== 'all' && doc.type !== typeFilter) return false;
        if (q.length < 1) return true;
        return (
          doc.title.toLowerCase().includes(q) ||
          doc.subtitle.toLowerCase().includes(q) ||
          doc.type.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        switch (sortMode) {
          case 'recent': return new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime();
          case 'oldest': return new Date(a.lastOpened).getTime() - new Date(b.lastOpened).getTime();
          case 'a-z': return a.title.localeCompare(b.title);
          case 'z-a': return b.title.localeCompare(a.title);
          default: return 0;
        }
      });
  }, [sortMode, typeFilter, debouncedSearch]);

  const getSortLabel = () => ({ recent: 'Most Recent', oldest: 'Oldest', 'a-z': 'A-Z', 'z-a': 'Z-A' }[sortMode] ?? 'Most Recent');
  const getTypeLabel = () => ({ all: 'Type', book: 'Book', report: 'Report', pdf: 'PDF' }[typeFilter] ?? 'Type');

  const isFiltered = debouncedSearch.length >= 1;
  const total = mockDocuments.filter((d) => typeFilter === 'all' || d.type === typeFilter).length;

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

        <div className="flex gap-2 text-sm items-center">
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => { setSortDropdownOpen(!sortDropdownOpen); setTypeDropdownOpen(false); }}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              {getSortLabel()}
              <ChevronDown size={14} className={`transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                {(['recent', 'oldest', 'a-z', 'z-a'] as SortMode[]).map((mode) => (
                  <button key={mode} onClick={() => { setSortMode(mode); setSortDropdownOpen(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    {{ recent: 'Most Recent', oldest: 'Oldest', 'a-z': 'A-Z', 'z-a': 'Z-A' }[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Type Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => { setTypeDropdownOpen(!typeDropdownOpen); setSortDropdownOpen(false); }}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              {getTypeLabel()}
              <ChevronDown size={14} className={`transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {typeDropdownOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                {(['all', 'book', 'report'] as TypeFilter[]).map((f) => (
                  <button key={f} onClick={() => { setTypeFilter(f); setTypeDropdownOpen(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors capitalize">
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Mode */}
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setViewMode('grid')}
              className={`p-2 rounded-full transition-colors ${viewMode === 'grid' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              aria-label="Grid view">
              <Grid2X2 size={18} />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-2 rounded-full transition-colors ${viewMode === 'list' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              aria-label="List view">
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className={viewMode === 'grid' ? 'grid sm:grid-cols-2 gap-6' : 'space-y-4'}>
        {filteredAndSortedDocuments.map((doc) => (
          <ReadingCard key={doc.id} document={doc} viewMode={viewMode} />
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
                className="text-sm text-primary hover:text-primary-dark transition-colors font-medium"
              >
                Clear search
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No documents matched your current filters.
            </p>
          )}
        </div>
      )}

      {(sortDropdownOpen || typeDropdownOpen) && (
        <div className="fixed inset-0 z-0" onClick={() => { setSortDropdownOpen(false); setTypeDropdownOpen(false); }} />
      )}
    </div>
  );
}
