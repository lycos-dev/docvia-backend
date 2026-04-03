import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import * as pdfService from '../services/pdfService';
import type { DocumentItem } from '../../features/dashboard/types';

const STORAGE_KEY = (userId: string) => `docvia-documents-${userId}`;

const EMPTY_PROGRESS: DocumentItem['progress'] = {
  completedLessons: 0,
  totalLessons: 0,
  percentage: 0,
  lastAccessedAt: null,
  streakDays: 0,
};

interface DocumentsContextValue {
  documents: DocumentItem[];
  isLoading: boolean;
  addDocument: (doc: DocumentItem) => void;
  removeDocument: (filename: string) => void;
  updateDocument: (filename: string, updates: Partial<DocumentItem>) => void;
}

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Load local metadata (thumbnails, progress saved by this user)
    let local: DocumentItem[] = [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY(user.id));
      local = stored ? (JSON.parse(stored) as DocumentItem[]) : [];
    } catch {
      local = [];
    }

    // Fetch the global backend list so every account sees every PDF
    pdfService.listPDFs(token ?? undefined).then((backendFiles) => {
      if (backendFiles.length === 0) {
        // Backend unreachable — fall back to local cache
        setDocuments(local);
        setIsLoading(false);
        return;
      }

      const localByFilename = new Map(local.map((d) => [d.filename, d]));

      // Merge: backend is source of truth for which files exist;
      // local cache supplies thumbnail / progress metadata
      const merged: DocumentItem[] = backendFiles.map((f, idx) => {
        const cached = localByFilename.get(f.filename);
        return cached ?? {
          id: Date.now() + idx,
          filename: f.filename,
          title: f.name,
          subtitle: '',
          type: 'pdf' as const,
          lastOpened: f.uploadedAt,
          coverImage: null,
          firstPageThumbnail: null,
          progress: EMPTY_PROGRESS,
        };
      });

      // Persist merged list so it's available offline
      try {
        localStorage.setItem(STORAGE_KEY(user.id), JSON.stringify(merged));
      } catch { /* ignore storage quota errors */ }

      setDocuments(merged);
      setIsLoading(false);
    }).catch(() => {
      // Backend unreachable — use local cache
      setDocuments(local);
      setIsLoading(false);
    });
  }, [user?.id, token]);

  const persist = useCallback(
    (docs: DocumentItem[]) => {
      if (user?.id) {
        try {
          localStorage.setItem(STORAGE_KEY(user.id), JSON.stringify(docs));
        } catch { /* ignore */ }
      }
    },
    [user?.id]
  );

  const addDocument = useCallback(
    (doc: DocumentItem) => {
      setDocuments((prev) => {
        const exists = prev.some((d) => d.filename === doc.filename);
        const next = exists ? prev : [doc, ...prev];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const removeDocument = useCallback(
    (filename: string) => {
      setDocuments((prev) => {
        const next = prev.filter((d) => d.filename !== filename);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const updateDocument = useCallback(
    (filename: string, updates: Partial<DocumentItem>) => {
      setDocuments((prev) => {
        const next = prev.map((d) => (d.filename === filename ? { ...d, ...updates } : d));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return (
    <DocumentsContext.Provider value={{ documents, isLoading, addDocument, removeDocument, updateDocument }}>
      {children}
    </DocumentsContext.Provider>
  );
}

export function useDocuments(): DocumentsContextValue {
  const ctx = useContext(DocumentsContext);
  if (!ctx) throw new Error('useDocuments must be used within DocumentsProvider');
  return ctx;
}
