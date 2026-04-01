import React, { useMemo, useState } from 'react';
import { EllipsisVertical, Grid2x2, List } from 'lucide-react';

type DocumentItem = {
  id: number;
  title: string;
  subtitle: string;
  type: 'book' | 'report';
  lastOpened: string;
  color: string;
};

type ReadingDocumentsProps = {
  searchTerm: string;
};

const docs: DocumentItem[] = [
  {
    id: 1,
    title: 'Project Notes',
    subtitle: 'Weekly planning and action items',
    type: 'report',
    lastOpened: '2026-02-10',
    color: 'from-[#7689ab] to-[#a6b4cd]',
  },
  {
    id: 2,
    title: 'Research Draft',
    subtitle: 'Reading preview text',
    type: 'book',
    lastOpened: '2026-02-18',
    color: 'from-[#825f3f] to-[#2b1f19]',
  },
  {
    id: 3,
    title: 'Meeting Summary',
    subtitle: 'Sprint call highlights',
    type: 'report',
    lastOpened: '2026-01-27',
    color: 'from-[#7e9387] to-[#9cb7a4]',
  },
];

export const ReadingDocuments: React.FC<ReadingDocumentsProps> = ({ searchTerm }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<'recent' | 'oldest'>('recent');
  const [typeFilter, setTypeFilter] = useState<'all' | DocumentItem['type']>('all');

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return docs
      .filter((doc) => (typeFilter === 'all' ? true : doc.type === typeFilter))
      .filter((doc) => {
        if (!normalizedSearch) {
          return true;
        }

        return (
          doc.title.toLowerCase().includes(normalizedSearch) ||
          doc.subtitle.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((first, second) => {
        if (sortMode === 'recent') {
          return new Date(second.lastOpened).getTime() - new Date(first.lastOpened).getTime();
        }

        return new Date(first.lastOpened).getTime() - new Date(second.lastOpened).getTime();
      });
  }, [searchTerm, sortMode, typeFilter]);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[38px] leading-none font-semibold text-[#525252]">Your Reading Documents 📁</h3>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`grid h-8 w-8 place-items-center rounded-full ${viewMode === 'grid' ? 'bg-[#dbe5f5] text-[#556b93]' : 'text-[#7e7e7e] hover:bg-[#e9e9e9]'}`}
            aria-pressed={viewMode === 'grid'}
          >
            <Grid2x2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`grid h-8 w-8 place-items-center rounded-full ${viewMode === 'list' ? 'bg-[#dbe5f5] text-[#556b93]' : 'text-[#7e7e7e] hover:bg-[#e9e9e9]'}`}
            aria-pressed={viewMode === 'list'}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      <div className="mb-6 flex gap-3">
        <select
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as 'recent' | 'oldest')}
          className="h-8 rounded-full border border-[#d8d8d8] bg-white px-4 text-xs text-[#666]"
        >
          <option value="recent">Most Recent</option>
          <option value="oldest">Oldest</option>
        </select>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as 'all' | DocumentItem['type'])}
          className="h-8 rounded-full border border-[#d8d8d8] bg-white px-4 text-xs text-[#666]"
        >
          <option value="all">Type</option>
          <option value="book">Book</option>
          <option value="report">Report</option>
        </select>
      </div>

      <div className={viewMode === 'grid' ? 'grid gap-5 sm:grid-cols-2' : 'space-y-4'}>
        {filteredDocuments.map((doc) => (
          <article
            key={doc.id}
            className={`overflow-hidden rounded-3xl border border-[#d8d8d8] bg-white shadow-[0_3px_10px_rgba(0,0,0,0.08)] ${
              viewMode === 'list' ? 'flex items-center' : ''
            }`}
          >
            <div
              className={`bg-linear-to-r ${doc.color} ${
                viewMode === 'list' ? 'h-20 w-24 shrink-0' : 'h-28 w-full'
              }`}
            />
            <div className="flex flex-1 items-center justify-between px-5 py-4">
              <div>
                <p className="text-[32px] leading-none font-semibold text-[#454545]">{doc.title}</p>
                <p className="mt-1 text-[14px] text-[#7c7c7c]">{doc.subtitle}</p>
              </div>
              <button type="button" className="rounded-md p-1 hover:bg-[#f2f2f2]">
                <EllipsisVertical className="text-[#606060]" size={18} />
              </button>
            </div>
          </article>
        ))}
      </div>

      {!filteredDocuments.length ? (
        <p className="mt-6 text-sm text-[#6d6d6d]">No documents matched your current filters.</p>
      ) : null}
    </section>
  );
};