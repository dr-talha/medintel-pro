'use client';

import { useState } from 'react';

const user = {
  name: 'Amina Khan',
  email: 'amina.khan@example.com',
  plan: 'MedIntel Pro Early Access',
  location: 'Lahore / Remote Care',
  clinician: 'Dr. Sara Malik',
};

const savedArticles = [
  'Understanding blood pressure readings before your next visit',
  'Diabetes check-ins: small habits that support glucose stability',
  'Preparing for a telehealth appointment like a pro',
];

const healthLog = [
  { label: 'Blood pressure', value: '124/78 mmHg', note: 'Logged this morning' },
  { label: 'Fasting glucose', value: '96 mg/dL', note: 'Within personal target' },
  { label: 'Medication reminder', value: '2 active', note: 'Next reminder at 8:00 PM' },
];

const savedCalculators = ['BMI Calculator', 'Dosage Safety Estimator', 'Hydration Goal Planner'];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'saved' | 'log'>('overview');

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 px-4 py-8 text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-cyan-100 bg-white p-6 shadow-2xl shadow-cyan-900/10 dark:border-cyan-900/40 dark:bg-slate-950 dark:shadow-black/40 sm:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-cyan-600 text-3xl font-black text-white shadow-xl shadow-cyan-600/25 dark:bg-cyan-400 dark:text-slate-950">AK</div>
              <div>
                <p className="text-sm font-black uppercase tracking-[0.32em] text-cyan-700 dark:text-cyan-300">User Profile</p>
                <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{user.name}</h1>
                <p className="mt-2 text-base font-semibold text-slate-600 dark:text-slate-300">{user.email}</p>
              </div>
            </div>
            <button type="button" className="rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white transition hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-500/30 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-200">
              Edit Profile
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-900">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Plan</p>
              <p className="mt-2 text-lg font-black">{user.plan}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-900">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Care region</p>
              <p className="mt-2 text-lg font-black">{user.location}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5 dark:bg-slate-900">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">Primary clinician</p>
              <p className="mt-2 text-lg font-black">{user.clinician}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'saved', label: 'Saved Articles' },
            { id: 'log', label: 'Health Log' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'overview' | 'saved' | 'log')}
              className={`rounded-2xl px-5 py-3 text-sm font-black transition ${activeTab === tab.id ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20 dark:bg-cyan-400 dark:text-slate-950' : 'bg-white text-slate-700 hover:bg-cyan-50 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30 sm:p-8">
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-3xl font-black tracking-tight">Dashboard overview</h2>
                <p className="mt-3 text-slate-600 dark:text-slate-300">Your future Supabase-powered dashboard will summarize saved content, health activity, and care tools in one secure place.</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl bg-cyan-50 p-5 dark:bg-cyan-950/30"><p className="text-3xl font-black">{savedArticles.length}</p><p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">Saved articles</p></div>
                  <div className="rounded-3xl bg-emerald-50 p-5 dark:bg-emerald-950/30"><p className="text-3xl font-black">{healthLog.length}</p><p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">Health log items</p></div>
                  <div className="rounded-3xl bg-indigo-50 p-5 dark:bg-indigo-950/30"><p className="text-3xl font-black">{savedCalculators.length}</p><p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">Saved calculators</p></div>
                </div>
              </div>
            )}

            {activeTab === 'saved' && (
              <div>
                <h2 className="text-3xl font-black tracking-tight">Saved medical articles</h2>
                <div className="mt-6 space-y-3">
                  {savedArticles.map((article) => (
                    <div key={article} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900">
                      <p className="font-black">{article}</p>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Saved for later review and clinician discussion.</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'log' && (
              <div>
                <h2 className="text-3xl font-black tracking-tight">Health log</h2>
                <div className="mt-6 space-y-3">
                  {healthLog.map((entry) => (
                    <div key={entry.label} className="flex flex-col gap-2 rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="font-black">{entry.label}</p><p className="text-sm text-slate-600 dark:text-slate-300">{entry.note}</p></div>
                      <p className="text-lg font-black text-cyan-700 dark:text-cyan-300">{entry.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30 sm:p-8">
            <h2 className="text-2xl font-black tracking-tight">Saved calculators</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Quick access to tools you use frequently. Results should always be confirmed with a qualified clinician.</p>
            <div className="mt-5 space-y-3">
              {savedCalculators.map((calculator) => (
                <button key={calculator} type="button" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-black transition hover:border-cyan-300 hover:bg-cyan-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-cyan-800 dark:hover:bg-cyan-950/30">
                  {calculator}
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
              Privacy note: this mock UI is ready for Supabase authentication and row-level security integration in the next phase.
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
