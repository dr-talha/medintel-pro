export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-400">MedIntel Pro</p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">Next.js AI/RAG engine is ready.</h1>
      <p className="mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
        Use the floating chat button to query verified MedIntel Supabase context with a guarded live-search fallback.
      </p>
    </main>
  );
}
