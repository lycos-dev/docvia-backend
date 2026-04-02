import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import type { DocumentItem } from '../../features/dashboard/types';

const STORAGE_KEY = (userId: string) => `docvia-documents-${userId}`;

interface DocumentsContextValue {
  documents: DocumentItem[];
  isLoading: boolean;
  addDocument: (doc: DocumentItem) => void;
  removeDocument: (filename: string) => void;
  updateDocument: (filename: string, updates: Partial<DocumentItem>) => void;
}

const DocumentsContext = createContext<DocumentsContextValue | null>(null);

export function DocumentsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY(user.id));
      setDocuments(stored ? (JSON.parse(stored) as DocumentItem[]) : []);
    } catch {
      setDocuments([]);
    }
    setIsLoading(false);
  }, [user?.id]);

  const persist = useCallback(
    (docs: DocumentItem[]) => {
      if (user?.id) {
        localStorage.setItem(STORAGE_KEY(user.id), JSON.stringify(docs));
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
