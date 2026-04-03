// src/features/reader/components/AIChatPanel.tsx
import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';
import { sendChat } from '../services/readerService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
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
  'Explain this section in simple terms',
  'Give me a quiz on this lesson',
  'What are the key takeaways?',
];

const DEFAULT_ERROR_RESPONSE =
  'I could not reach the AI tutor right now. Please try again in a moment.';

export default function AIChatPanel({
  documentId, lessonId, lessonTitle, lessonContent, isDark, token, injectMessage, onInjectHandled,
}: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = 20;
    const maxHeight = lineHeight * 3 + 16; // 3 rows + padding
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsTyping(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const data = await sendChat(documentId, lessonTitle, lessonContent, trimmed, history, token);
      if (!data.success || !data.reply) {
        throw new Error(data.error ?? data.message ?? 'Chat request failed.');
      }
      const replyText = data.reply;

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: replyText,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: 'Poppins, sans-serif' }}>
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
                  'w-full text-left px-3 py-2 rounded-xl text-sm transition-colors',
                  'bg-gray-50 dark:bg-[#0f172a]',
                  'text-[#111827] dark:text-[#F1F5F9]',
                  'border border-black/10 dark:border-white/10',
                  'hover:bg-gray-100 dark:hover:bg-white/5',
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
            className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] px-4 py-2 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-[#3B82F6] text-white rounded-2xl rounded-tr-sm'
                  : cn(
                      'rounded-2xl rounded-tl-sm',
                      'bg-gray-100 dark:bg-[#0f172a]',
                      'text-[#111827] dark:text-[#F1F5F9]',
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
                'px-4 py-3 rounded-2xl rounded-tl-sm',
                'bg-gray-100 dark:bg-[#0f172a]',
              )}
            >
              <TypingDots isDark={isDark} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className={cn(
          'shrink-0 p-3 border-t border-black/10 dark:border-white/10',
          'bg-white dark:bg-[#1e293b]',
        )}
      >
        <div
          className={cn(
            'flex items-end gap-2 rounded-xl border px-3 py-2',
            'bg-gray-50 dark:bg-[#0f172a]',
            'border-black/10 dark:border-white/10',
            'focus-within:ring-1 focus-within:ring-[#3B82F6]',
          )}
        >
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
              'flex-1 resize-none bg-transparent text-sm leading-5 outline-none',
              'text-[#111827] dark:text-[#F1F5F9]',
              'placeholder:text-[#6B7280] dark:placeholder:text-[#94A3B8]',
              'disabled:opacity-50',
              'max-h-[76px] overflow-y-auto',
            )}
            style={{ fontFamily: 'Poppins, sans-serif' }}
          />
          <button
            onClick={() => handleSend(inputValue)}
            disabled={!inputValue.trim() || isTyping}
            className={cn(
              'shrink-0 p-1.5 rounded-lg transition-colors',
              inputValue.trim() && !isTyping
                ? 'bg-[#3B82F6] text-white hover:bg-[#2563EB]'
                : 'bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-white/30 cursor-not-allowed',
            )}
            aria-label="Send message"
          >
            <Send size={15} />
          </button>
        </div>
        <p className="text-xs text-[#6B7280] dark:text-[#94A3B8] mt-1.5 px-1">
          Enter to send · Shift+Enter for new line
        </p>
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
            'block w-2 h-2 rounded-full',
            isDark ? 'bg-[#94A3B8]' : 'bg-[#6B7280]',
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
