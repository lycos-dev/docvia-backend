// src/features/reader/components/AIChatPanel.tsx
import { useState, useEffect, useRef } from "react";
import { ArrowUpCircle } from "lucide-react";
import { cn } from "../../../shared/utils/cn";
import { sendChat } from "../services/readerService";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AIChatPanelProps {
  documentId: string;
  lessonId: string;
  lessonTitle: string;
  lessonContent: string;
  isDark: boolean;
  token?: string;
  /** When set, auto-sends this message into the chat */
  injectMessage?: string | null;
  onInjectHandled?: () => void;
}

const STARTER_CHIPS = [
  "Explain this section in simple terms",
  "Give me a quiz on this lesson",
  "What are the key takeaways?",
];

const DEFAULT_ERROR_RESPONSE =
  "I could not reach the AI tutor right now. Please try again in a moment.";

export default function AIChatPanel({
  documentId,
  lessonId: _lessonId,
  lessonTitle,
  lessonContent,
  isDark,
  token,
  injectMessage,
  onInjectHandled,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * 3 + 16; // 3 rows + padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsTyping(true);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const data = await sendChat(
        documentId,
        lessonTitle,
        lessonContent,
        trimmed,
        history,
        token,
      );
      if (!data.success || !data.reply) {
        throw new Error(data.error ?? data.message ?? "Chat request failed.");
      }
      const replyText = data.reply;

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: replyText,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: DEFAULT_ERROR_RESPONSE,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
    // message history and lesson context are required for contextual tutoring replies
  };

  // Auto-send injected messages (from TextSelectionTooltip)
  useEffect(() => {
    if (injectMessage) {
      handleSend(injectMessage);
      onInjectHandled?.();
    }
    // handleSend is stable within a render; injectMessage is the trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !isTyping && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] text-center mt-2">
              Ask the AI anything about this lesson
            </p>
            {STARTER_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => handleSend(chip)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-xl text-sm transition-colors cursor-pointer",
                  "bg-gray-50 dark:bg-[#0f172a]",
                  "text-[#111827] dark:text-[#F1F5F9]",
                  "border border-black/10 dark:border-white/10",
                  "hover:bg-gray-100 dark:hover:bg-white/5",
                )}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] px-4 py-2 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-[#3B82F6] text-white rounded-2xl rounded-tr-sm"
                  : cn(
                      "rounded-2xl rounded-tl-sm",
                      "bg-gray-100 dark:bg-[#0f172a]",
                      "text-[#111827] dark:text-[#F1F5F9]",
                    ),
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div
              className={cn(
                "flex items-center gap-2.5 px-4 py-3 rounded-2xl rounded-tl-sm",
                "bg-gray-100 dark:bg-[#0f172a]",
              )}
            >
              {/* Spinning circle */}
              <svg
                style={{
                  width: 16,
                  height: 16,
                  color: "#4F7CDD",
                  animation: "spin 0.8s linear infinite",
                  flexShrink: 0,
                }}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  style={{ opacity: 0.25 }}
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  style={{ opacity: 0.85 }}
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span style={{ fontSize: 12, color: "#4F7CDD", fontWeight: 500 }}>
                AI is thinking…
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className={cn(
          "shrink-0 p-4 border-t border-black/10 dark:border-white/10",
          "bg-white dark:bg-[#1e293b]",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-1",
            "bg-gray-50 dark:bg-[#0f172a]",
            "border-black/10 dark:border-white/10",
            "focus-within:ring-1 focus-within:ring-[#80AAE8]",
          )}
        >
          <div className="tooltip-wrap flex-1">
            <span className="tooltip-box">
              Enter to send · Shift+Enter for new line
            </span>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                adjustTextareaHeight();
              }}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask about this lesson…"
              disabled={isTyping}
              className={cn(
                "w-full resize-none bg-transparent text-sm leading-5 outline-none",
                "text-[#111827] dark:text-[#F1F5F9]",
                "placeholder:text-[#6B7280] dark:placeholder:text-[#94A3B8]",
                "disabled:opacity-50",
                "max-h-19 overflow-y-auto",
              )}
              style={{ fontFamily: "Inter, sans-serif" }}
            />
          </div>
          <div className="tooltip-wrap shrink-0">
            <span className="tooltip-box">Send message</span>
            <button
              onClick={() => handleSend(inputValue)}
              disabled={!inputValue.trim() || isTyping}
              className={cn(
                "p-1 rounded-full transition-all duration-200 flex items-center justify-center cursor-pointer",
                inputValue.trim() && !isTyping
                  ? "hover:scale-110 active:scale-95 opacity-100"
                  : "opacity-40 cursor-not-allowed",
              )}
              aria-label="Send message"
            >
              <ArrowUpCircle
                size={28} // 32 might be a bit large for a 1.5 padding button, 28 is a "sweet spot"
                strokeWidth={2}
                // Logic: If there is text, use your theme blue. Otherwise, use gray.
                color={inputValue.trim() && !isTyping ? "#80AAE8" : "#94A3B8"}
                // This creates the subtle blue inner-glow when active
                fill={
                  inputValue.trim() && !isTyping
                    ? "rgba(128, 170, 232, 0.1)"
                    : "none"
                }
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- Typing indicator dots -----
function TypingDots({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex items-center gap-1" aria-label="AI is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "block w-2 h-2 rounded-full",
            isDark ? "bg-[#94A3B8]" : "bg-[#6B7280]",
          )}
          style={{
            animation: `typingBounce 1.2s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
