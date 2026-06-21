'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const STORAGE_KEY = 'medintel-pro-global-chat-messages';
const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: 'assistant',
    content:
      'Hi, I am MedIntel Pro. Ask a medical education question and I will search the verified MedIntel database first, then clearly label any live-search fallback.',
  },
];

export default function GlobalChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedStoredMessages, setHasLoadedStoredMessages] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const storedMessages = window.localStorage.getItem(STORAGE_KEY);
      if (storedMessages) {
        const parsedMessages = JSON.parse(storedMessages) as ChatMessage[];
        if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
          setMessages(parsedMessages);
        }
      }
    } catch (error) {
      console.warn('Unable to load MedIntel chat history from localStorage:', error);
    } finally {
      setHasLoadedStoredMessages(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredMessages) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.warn('Unable to save MedIntel chat history to localStorage:', error);
    }
  }, [hasLoadedStoredMessages, messages]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading, isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmedInput }];
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

      setMessages([...nextMessages, { role: 'assistant', content: payload.content ?? 'No response was returned.' }]);
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: `Sorry, I could not complete that request. ${error instanceof Error ? error.message : 'Please try again.'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function clearHistory() {
    setMessages(INITIAL_MESSAGES);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {isOpen ? (
        <section className="flex h-[min(640px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40">
          <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <div>
              <h2 className="text-sm font-bold text-slate-950 dark:text-slate-50">MedIntel AI/RAG Chat</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Verified database first · guarded web fallback</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearHistory}
                className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                ×
              </button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
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
                className="rounded-2xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
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
        aria-label="Open MedIntel chat"
        className="group grid h-16 w-16 place-items-center rounded-full bg-cyan-600 text-2xl text-white shadow-xl shadow-cyan-900/30 transition hover:-translate-y-1 hover:bg-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-300 dark:bg-cyan-500 dark:text-slate-950 dark:shadow-cyan-950/40 dark:hover:bg-cyan-400"
      >
        <span aria-hidden="true" className="transition group-hover:scale-110">
          {isOpen ? '×' : '💬'}
        </span>
      </button>
    </div>
  );
}
