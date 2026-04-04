// src/features/reader/components/DeepDivePanel.tsx
import { useState, useEffect } from "react";
import { cn } from "../../../shared/utils/cn";

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
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

export default function DeepDivePanel({
  lessonTitle,
  lessonExplanation,
  lessonKeyPoints,
  documentTitle,
  isDark,
  onClose,
  token,
}: DeepDivePanelProps) {
  const [data, setData] = useState<DeepDiveData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setData(null);

    fetch("/api/pdf/lessons/deep-explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
        const json = (await res.json()) as {
          success: boolean;
          data?: DeepDiveData;
          error?: string;
        };
        if (cancelled) return;
        if (json.success && json.data) {
          setData(json.data);
        } else {
          setError(json.error ?? "Could not generate deep dive.");
        }
        setIsLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message ?? "Network error.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonTitle]);

  const surface = isDark
    ? "bg-[#011631] border-[#80AAE8]/20" // Deep navy background
    : "bg-gradient-to-b from-blue-50/50 to-white border-[#80AAE8]/30";
  const innerCard = isDark
    ? "bg-[#022658]/40 border-white/5"
    : "bg-white border-blue-100/80";

  return (
    <div
      className={cn(
        "mx-0 rounded-2xl overflow-hidden border-2 shadow-2xl",
        surface,
      )}
    >
      {/* HEADER SECTION */}
      <div
        className="flex items-start justify-between gap-3 px-5 py-4 md:px-6 md:py-5"
        style={{
          background: isDark
            ? "linear-gradient(135deg, #022658 0%, #011a3d 100%)" // Solid Navy for Dark
            : "linear-gradient(135deg, #80AAE8 0%, #6094e0 100%)", // Sky Blue for Light
        }}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/90 mb-1">
            Deep dive · Segment
          </p>
          <h4 className="text-sm md:text-base font-bold text-white leading-snug line-clamp-2">
            {lessonTitle}
          </h4>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-full p-2 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          ✕
        </button>
      </div>

      <div className="p-5 md:p-6 space-y-5 max-h-[min(70vh,560px)] overflow-y-auto">
        {/* LOADING STATE */}
        {isLoading && (
          <div className="flex items-center gap-3 text-[#6094e0] dark:text-[#80AAE8] text-sm font-medium">
            <span
              className="inline-block w-5 h-5 rounded-full border-2 animate-spin shrink-0"
              style={{
                borderColor: "rgba(128,170,232,.25)",
                borderTopColor: "#80AAE8",
              }}
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
              <DeepBlock
                title="Full walkthrough"
                isDark={isDark}
                accent="amber"
                className={innerCard}
              >
                <div className="space-y-3">
                  {splitParagraphs(data.detailed_explanation).map((p, i) => (
                    <p
                      key={i}
                      className="text-sm leading-relaxed text-[#374151] dark:text-[#cbd5e1]"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              </DeepBlock>
            )}

            {data.conceptual_breakdown && (
              <DeepBlock
                title="Concepts & definitions"
                isDark={isDark}
                accent="blue"
                className={innerCard}
              >
                <div className="space-y-3">
                  {splitParagraphs(data.conceptual_breakdown).map((p, i) => (
                    <p
                      key={i}
                      className="text-sm leading-relaxed text-[#374151] dark:text-[#cbd5e1]"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              </DeepBlock>
            )}

            {data.context_and_debates && (
              <DeepBlock
                title="Context & viewpoints"
                isDark={isDark}
                accent="amber"
                className={innerCard}
              >
                <div className="space-y-3">
                  {splitParagraphs(data.context_and_debates).map((p, i) => (
                    <p
                      key={i}
                      className="text-sm leading-relaxed text-[#374151] dark:text-[#cbd5e1]"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              </DeepBlock>
            )}

            {data.connections && (
              <DeepBlock
                title="Connections in the document"
                isDark={isDark}
                accent="blue"
                className={innerCard}
              >
                <div className="space-y-3">
                  {splitParagraphs(data.connections).map((p, i) => (
                    <p
                      key={i}
                      className="text-sm leading-relaxed text-[#374151] dark:text-[#cbd5e1]"
                    >
                      {p}
                    </p>
                  ))}
                </div>
              </DeepBlock>
            )}

            {data.why_it_matters && (
              <DeepBlock
                title="Why it matters"
                isDark={isDark}
                accent="emerald"
                className={innerCard}
              >
                <p className="text-sm leading-relaxed text-[#374151] dark:text-[#cbd5e1]">
                  {data.why_it_matters}
                </p>
              </DeepBlock>
            )}

            {data.examples && data.examples.length > 0 && (
              <DeepBlock
                title="Examples from the segment"
                isDark={isDark}
                accent="blue"
                className={innerCard}
              >
                <ul className="space-y-2">
                  {data.examples.map((e, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-[#374151] dark:text-[#cbd5e1]"
                    >
                      <span className="shrink-0">→</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </DeepBlock>
            )}

            {data.common_misconceptions &&
              data.common_misconceptions.length > 0 && (
                <DeepBlock
                  title="Common misconceptions"
                  isDark={isDark}
                  accent="amber"
                  className={innerCard}
                >
                  <ul className="space-y-2">
                    {data.common_misconceptions.map((m, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-[#374151] dark:text-[#cbd5e1]"
                      >
                        <span className="shrink-0">⚠</span>
                        <span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </DeepBlock>
              )}

            {data.study_tips && data.study_tips.length > 0 && (
              <DeepBlock
                title="Study tips"
                isDark={isDark}
                accent="emerald"
                className={innerCard}
              >
                <ul className="space-y-2">
                  {data.study_tips.map((t, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-[#374151] dark:text-[#cbd5e1]"
                    >
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
  accent: 'blue' | 'amber' | 'emerald'; // Changed 'violet' to 'blue'
  className?: string;
  children: React.ReactNode;
}

function DeepBlock({
  title,
  isDark,
  accent,
  className,
  children,
}: DeepBlockProps) {
 const bar = {
    blue: isDark ? 'bg-[#80AAE8]' : 'bg-[#6094e0]', // Theme specific
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
  }[accent];

  return (
    <div className={cn("rounded-xl border p-4 shadow-sm", className)}>
      <div className="flex items-center gap-2 mb-3">
        <span className={cn("h-2 w-1 rounded-full shrink-0", bar)} />
        <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] dark:text-[#94a3b8]">
          {title}
        </h5>
      </div>
      {children}
    </div>
  );
}
