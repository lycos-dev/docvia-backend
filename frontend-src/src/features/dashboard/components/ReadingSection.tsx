import { useState, useMemo } from "react";
import { ChevronDown, Grid2X2, List } from "lucide-react";
import ReadingCard from "./ReadingCard";
import type { DocumentItem, SortMode, TypeFilter } from "../types";

// Mock data - replace with actual API data later
const mockDocuments: DocumentItem[] = [
  {
    id: 1,
    title: "Testing Techniques",
    subtitle: "Testing techniques in test case development",
    type: "book",
    lastOpened: "2026-02-10",
    coverImage: "/assets/images/testing.png",
  },
  {
    id: 2,
    title: "Research Draft",
    subtitle: "Reading preview text",
    type: "report",
    lastOpened: "2026-02-18",
    coverImage: "/assets/images/research.jpg",
  },
  {
    id: 3,
    title: "Meeting Summary",
    subtitle: "Sprint call highlights",
    type: "report",
    lastOpened: "2026-01-27",
    coverImage: "/assets/images/meeting.jpg",
  },
  {
    id: 4,
    title: "Design System",
    subtitle: "Component library documentation",
    type: "book",
    lastOpened: "2026-02-15",
    coverImage: "/assets/images/design.png",
  },
];

interface ReadingSectionProps {
  searchTerm?: string;
  onSearchClear?: () => void;
}

export default function ReadingSection(_props: ReadingSectionProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);

  // Filter and sort documents
  const filteredAndSortedDocuments = useMemo(() => {
    return mockDocuments
      .filter((doc) => typeFilter === "all" || doc.type === typeFilter)
      .sort((a, b) => {
        switch (sortMode) {
          case "recent":
            return new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime();
          case "oldest":
            return new Date(a.lastOpened).getTime() - new Date(b.lastOpened).getTime();
          case "a-z":
            return a.title.localeCompare(b.title);
          case "z-a":
            return b.title.localeCompare(a.title);
          default:
            return 0;
        }
      });
  }, [sortMode, typeFilter]);

  const getSortLabel = () => {
    switch (sortMode) {
      case "recent": return "Most Recent";
      case "oldest": return "Oldest";
      case "a-z": return "A-Z";
      case "z-a": return "Z-A";
      default: return "Most Recent";
    }
  };

  const getTypeLabel = () => {
    switch (typeFilter) {
      case "all": return "Type";
      case "book": return "Book";
      case "report": return "Report";
      default: return "Type";
    }
  };

  return (
  <div>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
        Your Reading Documents 📁
      </h3>

      <div className="flex gap-2 text-sm items-center">
        {/* Sort Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setSortDropdownOpen(!sortDropdownOpen);
              setTypeDropdownOpen(false);
            }}
            className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
          >
            {getSortLabel()}
            <ChevronDown size={14} className={`transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {sortDropdownOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
              <button
                onClick={() => {
                  setSortMode("recent");
                  setSortDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Most Recent
              </button>
              <button
                onClick={() => {
                  setSortMode("oldest");
                  setSortDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Oldest
              </button>
              <button
                onClick={() => {
                  setSortMode("a-z");
                  setSortDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                A-Z
              </button>
              <button
                onClick={() => {
                  setSortMode("z-a");
                  setSortDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Z-A
              </button>
            </div>
          )}
        </div>

        {/* Type Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setTypeDropdownOpen(!typeDropdownOpen);
              setSortDropdownOpen(false);
            }}
            className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
          >
            {getTypeLabel()}
            <ChevronDown size={14} className={`transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {typeDropdownOpen && (
            <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
              <button
                onClick={() => {
                  setTypeFilter("all");
                  setTypeDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                All
              </button>
              <button
                onClick={() => {
                  setTypeFilter("book");
                  setTypeDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Book
              </button>
              <button
                onClick={() => {
                  setTypeFilter("report");
                  setTypeDropdownOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Report
              </button>
            </div>
          )}
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-full transition-colors ${
              viewMode === "grid"
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            aria-label="Grid view"
            title="Grid view"
          >
            <Grid2X2 size={18} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-full transition-colors ${
              viewMode === "list"
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            aria-label="List view"
            title="List view"
          >
            <List size={18} />
          </button>
        </div>
      </div>
    </div>

      {/* Dynamic Grid/List Layout */}
      <div className={viewMode === "grid" ? "grid sm:grid-cols-2 gap-6" : "space-y-4"}>
        {filteredAndSortedDocuments.map((doc) => (
          <ReadingCard key={doc.id} document={doc} viewMode={viewMode} />
        ))}
      </div>

      {/* Empty state */}
      {filteredAndSortedDocuments.length === 0 && (
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            No documents matched your current filters.
          </p>
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {(sortDropdownOpen || typeDropdownOpen) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setSortDropdownOpen(false);
            setTypeDropdownOpen(false);
          }}
        />
      )}
    </div>
  );
}