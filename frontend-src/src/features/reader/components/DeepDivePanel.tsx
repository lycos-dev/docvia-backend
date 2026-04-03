// src/features/reader/components/DeepDivePanel.tsx
import { useState, useEffect } from 'react';
import { cn } from '../../../shared/utils/cn';

interface DeepDiveData {
  detailed_explanation?: string;
  conceptual_breakdown?: string;
  context_and_debates?: string;
  connections?: string;
  why_it_matters?: string;
  examples?: string[];
  common_misconceptions?: string[];
  study_tips?: string[];
}

interface DeepDivePanelProps {
  lessonTitle: string;
  lessonExplanation: string;
  lessonKeyPoints: string[];
  documentTitle: string;
  isDark: boolean;
  onClose: () => void;
  token?: string;
}

function splitParagraphs(text: string | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean);
}

export default function DeepDivePanel({
  lessonTitle, lessonExplanation, lessonKeyPoints, documentTitle, isDark, onClose, token,
}: DeepDivePanelProps) {
  const [data, setData] = useState<DeepDiveData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setData(null);

    fetch('/api/pdf/lessons/deep-explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        title: lessonTitle,
        explanation: lessonExplanation,
        key_points: lessonKeyPoints,
        documentTitle,
      }),
    })
      .then(async (res) => {
        const json = await res.json() as { success: boolean; data?: DeepDiveData; error?: string };
        if (cancelled) return;
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error ?? 'Could not generate deep dive.');
        }
        setIsLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? 'Network error.');
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonTitle]);

  const surface = isDark ? 'bg-[#16121f] border-[#4c1d95]/40' : 'bg-gradient-to-b from-violet-50/50 to-white border-violet-200/80';
  const innerCard = isDark ? 'bg-[#1e1a2e]/90 border-white/10' : 'bg-white/80 border-violet-100';

  return (
    <div
      className={cn(
        'mx-0 rounded-2xl overflow-hidden border-2 shadow-xl',
        surface,
      )}
    >
      <div
        className="flex items-start justify-between gap-3 px-5 py-4 md:px-6 md:py-5"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #5b21b6 0%, #4c1d95 45%, #312e81 100%)'
            : 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 55%, #5b21b6 100%)',
        }}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80 mb-1">
            Deep dive · Segment
          </p>
          <h4 className="text-sm md:text-base font-bold text-white leading-snug line-clamp-2">
            {lessonTitle}
          </h4>
          <p className="text-[11px] text-white/70 mt-1 truncate max-w-full" title={documentTitle}>
            {documentTitle}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-full p-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close deep dive"
        >
          ✕
        </button>
      </div>

      <div className="p-5 md:p-6 space-y-5 max-h-[min(70vh,560px)] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center gap-3 text-violet-600 dark:text-violet-300 text-sm">
            <span
              className="inline-block w-5 h-5 rounded-full border-2 animate-spin shrink-0"
              style={{ borderColor: 'rgba(124,58,237,.25)', borderTopColor: '#7c3aed' }}
            />
            Building a detailed walkthrough…
          </div>
        )}

        {error && !isLoading && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {!isLoading && !error && data && (
          <div className="space-y-5">
            {data.detailed_explanation && (
              <DeepBlock title="Full walkthrough" isDark={isDark} accent="violet" className={innerCard}>
                <div className="space-y-3">
                  {splitParagraphs(data.detailed_explanation).map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed text-[#374151] dark:text-[#cbd5e1]">
                      {p}
                    </p>
                  ))}
                </div>
              </DeepBlock>
            )}

            {data.conceptual_breakdown && (
              <DeepBlock title="Concepts & definitions" isDark={isDark} accent="violet" className={innerCard}>
                <div className="space-y-3">
                  {splitParagraphs(data.conceptual_breakdown).map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed text-[#374151] dark:text-[#cbd5e1]">
                      {p}
                    </p>
                  ))}
                </div>
              </DeepBlock>
            )}

            {data.context_and_debates && (
              <DeepBlock title="Context & viewpoints" isDark={isDark} accent="amber" className={innerCard}>
                <div className="space-y-3">
                  {splitParagraphs(data.context_and_debates).map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed text-[#374151] dark:text-[#cbd5e1]">
                      {p}
                    </p>
                  ))}
                </div>
              </DeepBlock>
            )}

            {data.connections && (
              <DeepBlock title="Connections in the document" isDark={isDark} accent="sky" className={innerCard}>
                <div className="space-y-3">
                  {splitParagraphs(data.connections).map((p, i) => (
                    <p key={i} className="text-sm leading-relaxed text-[#374151] dark:text-[#cbd5e1]">
                      {p}
                    </p>
                  ))}
                </div>
              </DeepBlock>
            )}

            {data.why_it_matters && (
              <DeepBlock title="Why it matters" isDark={isDark} accent="emerald" className={innerCard}>
                <p className="text-sm leading-relaxed text-[#374151] dark:text-[#cbd5e1]">
                  {data.why_it_matters}
                </p>
              </DeepBlock>
            )}

            {data.examples && data.examples.length > 0 && (
              <DeepBlock title="Examples from the segment" isDark={isDark} accent="violet" className={innerCard}>
                <ul className="space-y-2">
                  {data.examples.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#374151] dark:text-[#cbd5e1]">
                      <span className="shrink-0">→</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </DeepBlock>
            )}

            {data.common_misconceptions && data.common_misconceptions.length > 0 && (
              <DeepBlock title="Common misconceptions" isDark={isDark} accent="amber" className={innerCard}>
                <ul className="space-y-2">
                  {data.common_misconceptions.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#374151] dark:text-[#cbd5e1]">
                      <span className="shrink-0">⚠</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </DeepBlock>
            )}

            {data.study_tips && data.study_tips.length > 0 && (
              <DeepBlock title="Study tips" isDark={isDark} accent="emerald" className={innerCard}>
                <ul className="space-y-2">
                  {data.study_tips.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#374151] dark:text-[#cbd5e1]">
                      <span className="shrink-0">✓</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </DeepBlock>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface DeepBlockProps {
  title: string;
  isDark: boolean;
  accent: 'violet' | 'amber' | 'sky' | 'emerald';
  className?: string;
  children: React.ReactNode;
}

function DeepBlock({ title, isDark, accent, className, children }: DeepBlockProps) {
  const bar = {
    violet: isDark ? 'bg-violet-500' : 'bg-violet-600',
    amber: isDark ? 'bg-amber-500' : 'bg-amber-500',
    sky: isDark ? 'bg-sky-500' : 'bg-sky-600',
    emerald: isDark ? 'bg-emerald-500' : 'bg-emerald-600',
  }[accent];

  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', className)}>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('h-2 w-1 rounded-full shrink-0', bar)} />
        <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] dark:text-[#94a3b8]">
          {title}
        </h5>
      </div>
      {children}
    </div>
  );
}
