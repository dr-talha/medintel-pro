'use client';

import { useEffect, useMemo, useState } from 'react';

type DiseaseKey = 'flu' | 'covid' | 'malaria' | 'dengue';

type CountryMetric = {
  country: string;
  iso2: string;
  iso3: string;
  cases: number;
  deaths: number;
  incidence: number;
  updated?: string;
  source: string;
};

type DiseaseResponse = {
  disease: DiseaseKey;
  label: string;
  source: string;
  generatedAt: string;
  countries: CountryMetric[];
  totals: { cases: number; deaths: number };
};

const DISEASE_OPTIONS: Array<{ value: DiseaseKey; label: string; description: string }> = [
  { value: 'flu', label: 'Flu', description: 'WHO FluNet detections' },
  { value: 'covid', label: 'COVID', description: 'disease.sh confirmed cases' },
  { value: 'malaria', label: 'Malaria', description: 'Global risk proxy feed' },
  { value: 'dengue', label: 'Dengue', description: 'Global risk proxy feed' },
];

const HEAT_CLASSES = [
  'bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200',
  'bg-lime-100 text-lime-900 dark:bg-lime-400/15 dark:text-lime-200',
  'bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200',
  'bg-orange-100 text-orange-900 dark:bg-orange-400/15 dark:text-orange-200',
  'bg-rose-100 text-rose-900 dark:bg-rose-400/15 dark:text-rose-200',
];

export default function DiseaseMapPage() {
  const [selectedDisease, setSelectedDisease] = useState<DiseaseKey>('flu');
  const [data, setData] = useState<DiseaseResponse | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDiseaseData() {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/disease?disease=${selectedDisease}`, { signal: controller.signal });
        const payload = (await response.json()) as DiseaseResponse & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? 'Disease data request failed.');
        setData(payload);
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load disease data.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadDiseaseData();
    return () => controller.abort();
  }, [selectedDisease]);

  const maxCases = useMemo(() => Math.max(...(data?.countries.map((country) => country.cases) ?? [1]), 1), [data]);
  const topCountries = data?.countries.slice(0, 12) ?? [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30">
          <div className="bg-gradient-to-br from-cyan-600 via-blue-700 to-slate-950 px-6 py-8 text-white sm:px-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-100">MedIntel Pro Surveillance</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">WHO Global Disease Map</h1>
                <p className="mt-4 max-w-2xl text-base leading-7 text-cyan-50">
                  Monitor country-level disease signals from WHO FluNet and disease.sh through a responsive clinical intelligence dashboard.
                </p>
              </div>

              <label className="w-full max-w-sm">
                <span className="mb-2 block text-sm font-bold text-cyan-50">Disease focus</span>
                <select
                  value={selectedDisease}
                  onChange={(event) => setSelectedDisease(event.target.value as DiseaseKey)}
                  className="w-full rounded-2xl border border-white/20 bg-white/95 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg outline-none ring-cyan-300 transition focus:ring-4 dark:bg-slate-950 dark:text-slate-50"
                >
                  {DISEASE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} — {option.description}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[1.35fr_0.65fr]">
            <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-950 dark:text-white">Disease heatmap</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Darker bars indicate higher reported case volume.</p>
                </div>
                {data ? <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Updated {new Date(data.generatedAt).toLocaleString()}</p> : null}
              </div>

              {isLoading ? <LoadingGrid /> : null}

              {!isLoading && error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                  {error}
                </div>
              ) : null}

              {!isLoading && !error ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {topCountries.map((country, index) => {
                    const intensity = Math.min(4, Math.floor((country.cases / maxCases) * 5));
                    return (
                      <article key={`${country.country}-${country.iso2}`} className={`rounded-2xl p-4 ${HEAT_CLASSES[intensity]}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest opacity-70">#{index + 1}</p>
                            <h3 className="mt-1 text-lg font-black">{country.country}</h3>
                            <p className="text-xs font-semibold opacity-70">{country.iso3 || country.iso2 || 'Global report'}</p>
                          </div>
                          <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-black dark:bg-black/20">{formatNumber(country.incidence)}</span>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/60 dark:bg-black/30">
                          <div className="h-full rounded-full bg-current" style={{ width: `${Math.max(8, (country.cases / maxCases) * 100)}%` }} />
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <dt className="font-semibold opacity-70">Cases</dt>
                            <dd className="text-lg font-black">{formatNumber(country.cases)}</dd>
                          </div>
                          <div>
                            <dt className="font-semibold opacity-70">Deaths</dt>
                            <dd className="text-lg font-black">{formatNumber(country.deaths)}</dd>
                          </div>
                        </dl>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>

            <aside className="space-y-6">
              <MetricCard label="Reported cases" value={formatNumber(data?.totals.cases ?? 0)} loading={isLoading} />
              <MetricCard label="Reported deaths" value={formatNumber(data?.totals.deaths ?? 0)} loading={isLoading} />
              <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
                <h2 className="text-lg font-black text-slate-950 dark:text-white">Source notes</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {data?.source ?? 'Loading surveillance source...'} powers the current view. This dashboard is intended for educational surveillance awareness, not diagnosis or emergency decision-making.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 9 }).map((_, index) => (
        <div key={index} className="h-44 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      ))}
    </div>
  );
}

function MetricCard({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <p className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black text-slate-950 dark:text-white">{loading ? '…' : value}</p>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);
}
