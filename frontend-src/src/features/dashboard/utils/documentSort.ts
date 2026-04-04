import type { DocumentItem, SortMode } from '../types';

/** Upload time in ms: `lastOpened` (ISO from merge/upload), else leading timestamp in storage filename. */
export function documentTimestampMs(doc: DocumentItem): number {
  const fromLast = Date.parse(doc.lastOpened);
  if (!Number.isNaN(fromLast)) return fromLast;
  const m = doc.filename.match(/^(\d+)_/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 0;
}

export function compareDocuments(a: DocumentItem, b: DocumentItem, mode: SortMode): number {
  switch (mode) {
    case 'recent': {
      const diff = documentTimestampMs(a) - documentTimestampMs(b);
      if (diff !== 0) return diff;
      return a.filename.localeCompare(b.filename);
    }
    case 'oldest': {
      const diff = documentTimestampMs(b) - documentTimestampMs(a);
      if (diff !== 0) return diff;
      return b.filename.localeCompare(a.filename);
    }
    case 'a-z': {
      const c = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      if (c !== 0) return c;
      return a.filename.localeCompare(b.filename);
    }
    case 'z-a': {
      const c = b.title.localeCompare(a.title, undefined, { sensitivity: 'base' });
      if (c !== 0) return c;
      return b.filename.localeCompare(a.filename);
    }
    default:
      return 0;
  }
}
