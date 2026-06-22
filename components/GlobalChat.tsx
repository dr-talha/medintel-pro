'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type ConversationSummary = {
  id: string;
  title: string;
  preview: string;
  messageNumber: number;
};

const STORAGE_KEY = 'medintel-pro-global-chat-messages';
const MAX_STORED_MESSAGES = 40;
const RECENT_CONVERSATION_LIMIT = 6;
const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      'Hi, I am MedIntel Pro. Ask a medical education question and I will search the verified MedIntel database first, then clearly label any live-search fallback.',
  },
];

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<ChatMessage>;
  return (
    (candidate.role === 'user' || candidate.role === 'assistant') &&
    typeof candidate.content === 'string' &&
    candidate.content.trim().length > 0
  );
}

function normalizeStoredMessages(value: string | null) {
  if (!value) return INITIAL_MESSAGES;

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return INITIAL_MESSAGES;

    const safeMessages = parsed.filter(isChatMessage).slice(-MAX_STORED_MESSAGES);
    return safeMessages.length > 0 ? safeMessages : INITIAL_MESSAGES;
  } catch (error) {
    console.warn('Unable to parse MedIntel chat history from localStorage:', error);
    return INITIAL_MESSAGES;
  }
}

function createConversationSummary(messages: ChatMessage[]) {
  return messages
    .reduce<ConversationSummary[]>((summaries, message, index) => {
      if (message.role !== 'user') return summaries;

      const nextAssistantMessage = messages.slice(index + 1).find((candidate) => candidate.role === 'assistant');
      const trimmedTitle = message.content.trim();
      const preview = nextAssistantMessage?.content.trim() || 'Awaiting MedIntel response';

      summaries.unshift({
        id: `${index}-${trimmedTitle.slice(0, 32)}`,
        title: trimmedTitle.length > 54 ? `${trimmedTitle.slice(0, 54)}…` : trimmedTitle,
        preview: preview.length > 72 ? `${preview.slice(0, 72)}…` : preview,
        messageNumber: index + 1,
      });

      return summaries;
    }, [])
    .slice(0, RECENT_CONVERSATION_LIMIT);
}

export default function GlobalChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedStoredMessages, setHasLoadedStoredMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const recentConversations = useMemo(() => createConversationSummary(messages), [messages]);

  useEffect(() => {
    const storedMessages = window.localStorage.getItem(STORAGE_KEY);
    setMessages(normalizeStoredMessages(storedMessages));
    setHasLoadedStoredMessages(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredMessages) return;

    try {
      const messagesToStore = messages.filter(isChatMessage).slice(-MAX_STORED_MESSAGES);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesToStore));
    } catch (error) {
      console.warn('Unable to save MedIntel chat history to localStorage:', error);
    }
  }, [hasLoadedStoredMessages, messages]);

  useEffect(() => {
    if (!isOpen) return;
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading, isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user' as const, content: trimmedInput }].slice(-MAX_STORED_MESSAGES);
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      const payload = (await response.json()) as { content?: string; error?: string };
      if (!response.ok) throw new Error(payload.error ?? 'Chat request failed.');

      setMessages([
        ...nextMessages,
        { role: 'assistant' as const, content: payload.content ?? 'No response was returned.' },
      ].slice(-MAX_STORED_MESSAGES));
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant' as const,
          content: `Sorry, I could not complete that request. ${error instanceof Error ? error.message : 'Please try again.'}`,
        },
      ].slice(-MAX_STORED_MESSAGES));
    } finally {
      setIsLoading(false);
    }
  }

  function clearHistory() {
    setMessages(INITIAL_MESSAGES);
    setInput('');

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MESSAGES));
    } catch (error) {
      console.warn('Unable to clear MedIntel chat history in localStorage:', error);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {isOpen ? (
        <section
          aria-label="MedIntel AI chat"
          className="flex h-[min(680px,calc(100vh-7rem))] w-[min(760px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40"
        >
          <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <div>
              <h2 className="text-sm font-bold text-slate-950 dark:text-slate-50">MedIntel AI/RAG Chat</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Verified database first · guarded web fallback</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearHistory}
                className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Clear History
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ×
              </button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 md:grid-cols-[240px_1fr]">
            <aside className="hidden min-h-0 border-r border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:flex md:flex-col">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Recent Conversations</h3>
                <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Saved locally on this device and available across page navigation.</p>
              </div>

              <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {recentConversations.length > 0 ? (
                  recentConversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-300 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-cyan-700 dark:hover:text-cyan-200"
                    >
                      <span className="block text-xs font-bold leading-5 text-slate-800 dark:text-slate-100">{conversation.title}</span>
                      <span className="mt-1 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">{conversation.preview}</span>
                      <span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Message {conversation.messageNumber}</span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-slate-300 p-3 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:text-slate-400">No saved conversations yet.</p>
                )}
              </div>

              <button
                type="button"
                onClick={clearHistory}
                className="mt-4 w-full rounded-2xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                Clear History
              </button>
            </aside>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950 md:hidden">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Recent Conversations</p>
                  <button type="button" onClick={clearHistory} className="text-xs font-bold text-cyan-700 dark:text-cyan-300">Clear History</button>
                </div>
                <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">{recentConversations[0]?.title ?? 'No saved conversations yet.'}</p>
              </div>

              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950'
                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {isLoading ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Searching MedIntel knowledge sources...
                  </div>
                </div>
              ) : null}
              <div ref={scrollRef} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <label htmlFor="global-chat-input" className="sr-only">
              Ask MedIntel Pro
            </label>
            <div className="flex gap-2">
              <textarea
                id="global-chat-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                rows={2}
                placeholder="Ask a medical education question..."
                className="min-h-12 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none ring-cyan-500 transition placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
              >
                Send
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-label={isOpen ? 'Close MedIntel chat' : 'Open MedIntel chat'}
        className="group grid h-16 w-16 place-items-center rounded-full bg-cyan-600 text-2xl text-white shadow-xl shadow-cyan-900/30 transition hover:-translate-y-1 hover:bg-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-300 dark:bg-cyan-500 dark:text-slate-950 dark:shadow-cyan-950/40 dark:hover:bg-cyan-400"
      >
        <span aria-hidden="true" className="transition group-hover:scale-110">
          {isOpen ? '×' : '💬'}
        </span>
      </button>
    </div>
  );
}
