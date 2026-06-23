'use client';

import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cyan-50 via-white to-slate-100 px-4 py-16 text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950 dark:text-white sm:px-6 lg:px-8">
      <section className="w-full max-w-2xl rounded-3xl border border-white/70 bg-white/85 p-8 text-center shadow-2xl shadow-cyan-900/10 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/85 dark:shadow-black/30 sm:p-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cyan-100 text-3xl font-black text-cyan-700 shadow-inner dark:bg-cyan-950 dark:text-cyan-200">
          404
        </div>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.32em] text-cyan-600 dark:text-cyan-300">
          Page not found
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
          We couldn&apos;t find that MedIntel Pro page.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
          The page may have moved, the link may be outdated, or the clinical resource may no longer be available. Return home to continue exploring medical AI tools, calculators, drug lookup, and first aid resources.
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl bg-cyan-600 px-7 font-bold text-white shadow-lg shadow-cyan-600/20 transition hover:-translate-y-0.5 hover:bg-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/25 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
        >
          Back to Home
        </button>
      </section>
    </main>
  );
}
