'use client';

import { useEffect } from 'react';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('MedIntel Pro route error:', error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-50 via-white to-slate-100 px-4 py-16 text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-rose-950 dark:text-white sm:px-6 lg:px-8">
      <section className="w-full max-w-2xl rounded-3xl border border-white/70 bg-white/85 p-8 text-center shadow-2xl shadow-rose-900/10 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/85 dark:shadow-black/30 sm:p-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-3xl font-black text-rose-700 shadow-inner dark:bg-rose-950 dark:text-rose-200">
          !
        </div>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.32em] text-rose-600 dark:text-rose-300">
          Something went wrong
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
          Sorry, MedIntel Pro hit an unexpected error.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
          Please try again. If the issue continues, refresh the page or return later while we stabilize this medical intelligence experience.
        </p>
        {error.digest ? (
          <p className="mx-auto mt-5 inline-flex rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Error reference: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl bg-rose-600 px-7 font-bold text-white shadow-lg shadow-rose-600/20 transition hover:-translate-y-0.5 hover:bg-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-500/25 dark:bg-rose-400 dark:text-slate-950 dark:hover:bg-rose-300"
        >
          Try Again
        </button>
      </section>
    </main>
  );
}
