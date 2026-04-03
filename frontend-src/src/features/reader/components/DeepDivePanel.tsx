// src/features/reader/components/DeepDivePanel.tsx
import { useState, useEffect } from 'react';
import { cn } from '../../../shared/utils/cn';

interface DeepDiveData {
  detailed_explanation?: string;
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

  return (
    <div
      className="mx-0 rounded-xl overflow-hidden border-2"
      style={{
        borderColor: '#ede9fe',
        background: isDark ? '#1e1a2e' : '#faf5ff',
        animation: 'fadeUp 0.3s ease',
      }}
    >
      {/* Purple header */}
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
      >
        <h4 className="text-sm font-bold text-white flex items-center gap-2">
          🔬 Deep Dive — {lessonTitle}
        </h4>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white text-lg leading-none transition-colors"
          aria-label="Close deep dive"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        {isLoading && (
          <div className="flex items-center gap-3" style={{ color: '#7c3aed', fontSize: 14 }}>
            <span
              className="inline-block w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(124,58,237,.25)', borderTopColor: '#7c3aed' }}
            />
            Generating your deep dive…
          </div>
        )}

        {error && !isLoading && (
          <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>
        )}

        {!isLoading && !error && data && (
          <>
            {data.detailed_explanation && (
              <DeepSection title="📖 Full Explanation" isDark={isDark}>
                <div className="space-y-3">
                  {data.detailed_explanation
                    .split(/\n{2,}/)
                    .map((p) => p.replace(/\n/g, ' ').trim())
                    .filter(Boolean)
                    .map((p, i) => (
                      <p key={i} className="text-sm leading-relaxed" style={{ color: isDark ? '#cbd5e1' : '#374151' }}>
                        {p}
                      </p>
                    ))}
                </div>
              </DeepSection>
            )}

            {data.why_it_matters && (
              <DeepSection title="🎯 Why It Matters" isDark={isDark}>
                <p className="text-sm leading-relaxed" style={{ color: isDark ? '#cbd5e1' : '#374151' }}>
                  {data.why_it_matters}
                </p>
              </DeepSection>
            )}

            {data.examples && data.examples.length > 0 && (
              <DeepSection title="Real-World Examples" isDark={isDark}>
                <ul className="space-y-1.5">
                  {data.examples.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: isDark ? '#cbd5e1' : '#374151' }}>
                      <span className="shrink-0">💼</span> {e}
                    </li>
                  ))}
                </ul>
              </DeepSection>
            )}

            {data.common_misconceptions && data.common_misconceptions.length > 0 && (
              <DeepSection title="Common Misconceptions" isDark={isDark}>
                <ul className="space-y-1.5">
                  {data.common_misconceptions.map((m, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: isDark ? '#cbd5e1' : '#374151' }}>
                      <span className="shrink-0">⚠️</span> {m}
                    </li>
                  ))}
                </ul>
              </DeepSection>
            )}

            {data.study_tips && data.study_tips.length > 0 && (
              <DeepSection title="✏️ Study Tips" isDark={isDark}>
                <ul className="space-y-1.5">
                  {data.study_tips.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: isDark ? '#cbd5e1' : '#374151' }}>
                      <span className="shrink-0">💡</span> {t}
                    </li>
                  ))}
                </ul>
              </DeepSection>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface DeepSectionProps {
  title: string;
  isDark: boolean;
  children: React.ReactNode;
}

function DeepSection({ title, isDark, children }: DeepSectionProps) {
  return (
    <div>
      <h5
        className="text-xs font-bold uppercase tracking-wider mb-2"
        style={{ color: isDark ? '#a78bfa' : '#7c3aed' }}
      >
        {title}
      </h5>
      {children}
    </div>
  );
}
