'use client';

import { FormEvent, useMemo, useState } from 'react';

type RxNormMatch = {
  rxcui?: string;
  name?: string;
  score?: string;
  rank?: string;
};

type DrugSearchPayload = {
  query: string;
  rxNorm?: { matches?: RxNormMatch[] };
  openFda?: { meta?: unknown; results?: unknown[]; error?: string | null };
};

export default function DrugSearchPage() {
  const [drugName, setDrugName] = useState('');
  const [result, setResult] = useState<DrugSearchPayload | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const rxNormMatches = useMemo(() => result?.rxNorm?.matches ?? [], [result]);
  const openFdaCount = result?.openFda?.results?.length ?? 0;
  const hasNoMatches = result && rxNormMatches.length === 0 && openFdaCount === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = drugName.trim();

    if (!query) {
      setError('Please enter a drug name before searching.');
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`/api/drugs?name=${encodeURIComponent(query)}`, { cache: 'no-store' });
      const payload = (await response.json()) as DrugSearchPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'The drug search could not be completed.');
      }

      setResult(payload);
      if ((payload.rxNorm?.matches?.length ?? 0) === 0 && (payload.openFda?.results?.length ?? 0) === 0) {
        setError(`No RxNorm or openFDA matches were found for “${query}”. Try a generic name or alternate spelling.`);
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Unexpected drug search error.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-slate-100 px-4 py-10 text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-3xl border border-white/70 bg-white/80 p-8 shadow-2xl shadow-cyan-900/10 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/80 dark:shadow-black/30">
          <p className="text-sm font-bold uppercase tracking-[0.32em] text-cyan-600 dark:text-cyan-300">PROMO #6 · Serverless Drug Proxy</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">Drug Search</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Search RxNorm concepts and openFDA safety signals through MedIntel Pro&apos;s internal Next.js API route. The browser never calls RxNorm or openFDA directly, preventing CORS failures and keeping server-side configuration private.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30 sm:p-8">
          <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label htmlFor="drug-search" className="sr-only">Drug name</label>
            <input
              id="drug-search"
              value={drugName}
              onChange={(event) => setDrugName(event.target.value)}
              placeholder="Enter a drug name, e.g. metformin"
              className="min-h-14 rounded-2xl border border-slate-300 bg-white px-5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="min-h-14 rounded-2xl bg-cyan-600 px-8 font-bold text-white shadow-lg shadow-cyan-600/20 transition hover:-translate-y-0.5 hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
            >
              {isLoading ? 'Searching…' : 'Search'}
            </button>
          </form>

          {isLoading ? <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-cyan-800 dark:border-cyan-900/60 dark:bg-cyan-950/40 dark:text-cyan-200">Contacting MedIntel drug proxy…</div> : null}

          {error ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">{error}</div> : null}

          {result && !isLoading ? (
            <section className="mt-8 space-y-5">
              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/70 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-bold">Results for “{result.query}”</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">RxNorm matches: {rxNormMatches.length} · openFDA records returned: {openFdaCount}</p>
                </div>
                <span className="rounded-full bg-cyan-100 px-4 py-2 text-xs font-bold uppercase tracking-wide text-cyan-700 dark:bg-cyan-950 dark:text-cyan-200">CORS-safe proxy</span>
              </div>

              {!hasNoMatches ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {rxNormMatches.map((match) => (
                    <article key={`${match.rxcui}-${match.name}`} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                      <h3 className="font-bold text-slate-950 dark:text-white">{match.name ?? 'Unnamed RxNorm concept'}</h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">RxCUI: {match.rxcui ?? 'N/A'}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Score: {match.score ?? 'N/A'} · Rank: {match.rank ?? 'N/A'}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
