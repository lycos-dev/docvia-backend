import { useEffect, useState, useCallback } from 'react';
import { fetchDictionary } from '../services/readerService';

interface TooltipPosition {
  top: number;
  left: number;
}

interface DictionaryEntry {
  word: string;
  pos: string;
  def: string;
}

interface TextSelectionTooltipProps {
  /** ID of the scrollable container where selection is valid */
  containerId: string;
  onExplain: (text: string) => void;
  onFollowUp: (text: string) => void;
}

export default function TextSelectionTooltip({ containerId, onExplain, onFollowUp }: TextSelectionTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition>({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [dictEntry, setDictEntry] = useState<DictionaryEntry | null>(null);
  const [dictLoading, setDictLoading] = useState(false);

  const hide = useCallback(() => {
    setVisible(false);
    setDictEntry(null);
    setSelectedText('');
  }, []);

  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { hide(); return; }

      const text = sel.toString().trim();
      if (text.length < 2 || text.length > 300) { hide(); return; }

      // Only trigger inside the designated container
      const container = document.getElementById(containerId);
      if (!container) { hide(); return; }
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) { hide(); return; }

      setSelectedText(text);
      setVisible(true);
      setDictEntry(null);

      // Position the tooltip above the selection
      requestAnimationFrame(() => {
        const rect = range.getBoundingClientRect();
        const TW = 240;
        const TH = 100;
        const GUTTER = 8;
        let top = rect.top + window.scrollY - TH - GUTTER;
        let left = rect.left + window.scrollX + rect.width / 2 - TW / 2;
        left = Math.max(GUTTER, Math.min(left, window.innerWidth - TW - GUTTER));
        if (rect.top - TH - GUTTER < 0) top = rect.bottom + window.scrollY + GUTTER;
        setPosition({ top, left });
      });

      // For single words, fetch dictionary
      const isSingleWord = !/\s/.test(text) && text.length <= 30;
      if (isSingleWord) {
        setDictLoading(true);
        fetchDictionary(text).then((entry) => {
          setDictEntry(entry);
          setDictLoading(false);
        });
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, [containerId, hide]);

  const handleExplain = () => {
    hide();
    window.getSelection()?.removeAllRanges();
    onExplain(selectedText);
  };

  const handleFollowUp = () => {
    hide();
    window.getSelection()?.removeAllRanges();
    onFollowUp(selectedText);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed z-[100] bg-white dark:bg-[#1e293b] rounded-xl shadow-xl border border-black/10 dark:border-white/10 p-3 w-60"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()} // prevent selection loss
    >
      {/* Dictionary entry for single words */}
      {(dictLoading || dictEntry) && (
        <div className="mb-2 pb-2 border-b border-black/10 dark:border-white/10">
          {dictLoading ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 animate-pulse">Looking up…</p>
          ) : dictEntry ? (
            <>
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{dictEntry.word}</p>
              {dictEntry.pos && <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">{dictEntry.pos}</p>}
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{dictEntry.def}</p>
            </>
          ) : null}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleExplain}
          className="flex-1 py-1.5 px-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          💡 Explain
        </button>
        <button
          onClick={handleFollowUp}
          className="flex-1 py-1.5 px-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
        >
          💬 Follow-up
        </button>
      </div>
    </div>
  );
}
