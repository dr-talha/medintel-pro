'use client';

import { useEffect, useState } from 'react';

type IngestedDoc = {
  title: string;
  source_url: string;
  chunks: number;
  ingested_at: string;
};

type IngestResult = {
  success: boolean;
  title?: string;
  fileType?: string;
  totalChunks?: number;
  stored?: number;
  characterCount?: number;
  errors?: string[];
  error?: string;
};

export default function AdminIngestPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);

  const [docs, setDocs] = useState<IngestedDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    // Verify by trying to load docs
    setDocsLoading(true);
    const res = await fetch(`/api/ingest?password=${encodeURIComponent(password)}`);
    const data = await res.json();
    if (res.ok) {
      setAuthed(true);
      setDocs(data.documents ?? []);
    } else {
      setAuthError('Wrong password. Check your INGEST_PASSWORD env var (default: medintel-admin).');
    }
    setDocsLoading(false);
  }

  async function loadDocs() {
    setDocsLoading(true);
    const res = await fetch(`/api/ingest?password=${encodeURIComponent(password)}`);
    const data = await res.json();
    if (res.ok) setDocs(data.documents ?? []);
    setDocsLoading(false);
  }

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), title: title.trim() || undefined, password }),
      });
      const data = (await res.json()) as IngestResult;
      setResult(data);
      if (data.success) {
        setUrl('');
        setTitle('');
        await loadDocs();
      }
    } catch {
      setResult({ success: false, error: 'Network error. Please try again.' });
    }
    setLoading(false);
  }

  async function handleDelete(sourceUrl: string) {
    if (!confirm('Delete all chunks for this document? This cannot be undone.')) return;
    setDeletingUrl(sourceUrl);
    await fetch('/api/ingest', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_url: sourceUrl, password }),
    });
    setDeletingUrl(null);
    await loadDocs();
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-700 text-lg font-black text-white">
              MI
            </span>
            <div>
              <p className="font-extrabold text-white">MedIntel Pro</p>
              <p className="text-xs text-cyan-400 uppercase tracking-widest">Admin Panel</p>
            </div>
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Document Ingest</h1>
          <p className="text-sm text-slate-400 mb-6">Enter your admin password to manage your knowledge base.</p>
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            />
            {authError && <p className="text-sm text-red-400">{authError}</p>}
            <button
              type="submit"
              disabled={docsLoading}
              className="w-full rounded-2xl bg-cyan-600 py-3 font-bold text-white hover:bg-cyan-500 disabled:opacity-50 transition"
            >
              {docsLoading ? 'Verifying…' : 'Enter Admin Panel'}
            </button>
          </form>
          <p className="mt-4 text-xs text-slate-600">
            Default password: <span className="text-slate-400 font-mono">medintel-admin</span>
            {' '}— change via <span className="font-mono">INGEST_PASSWORD</span> in .env.local
          </p>
        </div>
      </main>
    );
  }

  // ── Main admin UI ─────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-700 text-lg font-black text-white">
              MI
            </span>
            <div>
              <p className="font-extrabold text-white">MedIntel Pro</p>
              <p className="text-xs text-cyan-400 uppercase tracking-widest">Knowledge Base Manager</p>
            </div>
          </div>
          <a href="/" className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition">
            ← Back to site
          </a>
        </div>

        {/* How it works */}
        <div className="rounded-3xl border border-cyan-900/60 bg-cyan-950/30 p-6">
          <h2 className="text-lg font-black text-cyan-300 mb-3">📖 How to add your Google Drive files</h2>
          <ol className="space-y-2 text-sm text-slate-300">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-black">1</span>
              Open any PDF or DOCX file in Google Drive
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-black">2</span>
              Click <strong className="text-white">Share</strong> → set to <strong className="text-white">"Anyone with the link"</strong> → click <strong className="text-white">Copy link</strong>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-black">3</span>
              Paste the link below, give it a name, and click <strong className="text-white">Ingest File</strong>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-black">4</span>
              Done — Claude will instantly use this data when answering questions in the chat
            </li>
          </ol>
        </div>

        {/* Ingest form */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h2 className="text-xl font-black mb-5">➕ Add New Document</h2>
          <form onSubmit={handleIngest} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-300">
                Google Drive Link <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/…/view?usp=sharing"
                required
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-mono text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Supports PDF and DOCX files. File must be shared as "Anyone with the link".</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-slate-300">
                Document Title <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Pharmacology Notes Chapter 3, Pakistan Drug Formulary 2024"
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-white placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full rounded-2xl bg-cyan-600 py-3 font-bold text-white hover:bg-cyan-500 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Processing file… this may take 30–60 seconds for large files
                </>
              ) : (
                '⚡ Ingest File'
              )}
            </button>
          </form>

          {/* Result */}
          {result && (
            <div className={`mt-5 rounded-2xl border p-5 ${result.success ? 'border-emerald-800 bg-emerald-950/40' : 'border-red-800 bg-red-950/40'}`}>
              {result.success ? (
                <div>
                  <p className="font-black text-emerald-300 text-lg mb-3">✅ Successfully ingested!</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'File type', value: result.fileType?.toUpperCase() ?? '–' },
                      { label: 'Characters', value: result.characterCount?.toLocaleString() ?? '–' },
                      { label: 'Chunks created', value: String(result.totalChunks ?? '–') },
                      { label: 'Stored in DB', value: String(result.stored ?? '–') },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl bg-emerald-900/40 p-3 text-center">
                        <p className="text-lg font-black text-emerald-200">{value}</p>
                        <p className="text-xs text-emerald-400">{label}</p>
                      </div>
                    ))}
                  </div>
                  {result.errors?.length ? (
                    <div className="mt-3 rounded-xl border border-amber-800 bg-amber-950/40 p-3">
                      <p className="text-xs font-bold text-amber-300 mb-1">⚠️ Some chunks had errors:</p>
                      {result.errors.slice(0, 3).map((e, i) => (
                        <p key={i} className="text-xs text-amber-400">{e}</p>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-3 text-sm text-emerald-400">
                    🧠 Claude can now answer questions from this document. Try asking in the chat!
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-black text-red-300 mb-2">❌ Ingest failed</p>
                  <p className="text-sm text-red-400">{result.error}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Common fixes: Make sure the file is shared as "Anyone with the link" in Google Drive.
                    Only PDF and DOCX files are supported. Scanned image-only PDFs cannot be read without OCR.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ingested documents list */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-black">
              📚 Knowledge Base
              <span className="ml-2 rounded-full bg-cyan-900 px-3 py-1 text-sm font-bold text-cyan-300">
                {docs.length} document{docs.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <button
              onClick={loadDocs}
              disabled={docsLoading}
              className="rounded-2xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition disabled:opacity-50"
            >
              {docsLoading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>

          {docs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
              <p className="text-slate-400">No documents ingested yet.</p>
              <p className="text-sm text-slate-600 mt-1">Add your first file using the form above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => (
                <div
                  key={doc.source_url}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{doc.title}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{doc.source_url}</p>
                    <div className="flex gap-3 mt-2">
                      <span className="text-xs rounded-full bg-cyan-900/60 text-cyan-300 px-2 py-0.5 font-bold">
                        {doc.chunks} chunks
                      </span>
                      <span className="text-xs text-slate-600">
                        {new Date(doc.ingested_at).toLocaleDateString('en-PK', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.source_url)}
                    disabled={deletingUrl === doc.source_url}
                    className="shrink-0 rounded-xl border border-red-900 bg-red-950/40 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-900/60 transition disabled:opacity-50"
                  >
                    {deletingUrl === doc.source_url ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="font-black text-slate-300 mb-3">💡 Tips for best results</h3>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>• Give each file a clear, descriptive title so Claude can reference it properly</li>
            <li>• Text-based PDFs work best. Scanned image PDFs require OCR first</li>
            <li>• Large files (100+ pages) may take up to 60 seconds — please wait</li>
            <li>• You can re-ingest a file anytime — delete the old version first to avoid duplicates</li>
            <li>• After ingesting, test by asking Claude about something specific from that document</li>
            <li>• Organize files in Google Drive folders — you can ingest from any shared link</li>
          </ul>
        </div>

      </div>
    </main>
  );
}
