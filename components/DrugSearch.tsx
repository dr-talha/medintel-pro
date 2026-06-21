'use client';

import { FormEvent, useState } from 'react';

type DrugSearchResult = {
  query: string;
  rxNorm?: {
    matches?: Array<{
      rxcui?: string;
      name?: string;
      score?: string;
      rank?: string;
    }>;
  };
  openFda?: {
    results?: unknown[];
  };
};

export default function DrugSearch() {
  const [drugName, setDrugName] = useState('');
  const [result, setResult] = useState<DrugSearchResult | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = drugName.trim();
    if (!query) {
      setError('Enter a drug name to search.');
      setResult(null);
      return;
    }

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`/api/drugs?name=${encodeURIComponent(query)}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? 'Drug search failed.');
      }

      setResult(payload as DrugSearchResult);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Drug search failed.');
    } finally {
      setIsLoading(false);
    }
  }

  const rxNormMatches = result?.rxNorm?.matches ?? [];
  const fdaResultCount = result?.openFda?.results?.length ?? 0;

  return (
    <section className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30 sm:p-8">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-400">Secure Drug Lookup</p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
          Search clinical drug intelligence
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          This client component calls the internal Next.js API proxy only. External API keys stay on the server and are never exposed to browser JavaScript.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="drug-name" className="sr-only">
          Drug name
        </label>
        <input
          id="drug-name"
          type="text"
          value={drugName}
          onChange={(event) => setDrugName(event.target.value)}
          placeholder="Search e.g. metformin"
          className="min-h-12 flex-1 rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/15"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="min-h-12 rounded-2xl bg-cyan-600 px-6 font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {isLoading && (
        <div className="mt-6 animate-pulse space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {result && !isLoading && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/70">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Results for “{result.query}”</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            RxNorm matches: {rxNormMatches.length} · openFDA adverse event records returned: {fdaResultCount}
          </p>

          <ul className="mt-4 space-y-3">
            {rxNormMatches.map((match) => (
              <li key={`${match.rxcui}-${match.name}`} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{match.name ?? 'Unnamed RxNorm concept'}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">RxCUI: {match.rxcui ?? 'N/A'} · Score: {match.score ?? 'N/A'}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
