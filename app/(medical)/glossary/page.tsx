'use client';

import { useMemo, useState } from 'react';

type GlossaryTerm = {
  term: string;
  definition: string;
  specialty: string;
};

const terms: GlossaryTerm[] = [
  { term: 'Anemia', specialty: 'Hematology', definition: 'A condition in which the body has too few healthy red blood cells or too little hemoglobin to carry oxygen effectively.' },
  { term: 'Biopsy', specialty: 'Diagnostics', definition: 'A procedure that removes a small tissue sample so it can be examined for disease under a microscope.' },
  { term: 'Creatinine', specialty: 'Nephrology', definition: 'A blood marker used with other tests to estimate kidney filtration and monitor kidney function.' },
  { term: 'Diastolic pressure', specialty: 'Cardiology', definition: 'The lower blood pressure number, measured when the heart relaxes between beats.' },
  { term: 'Edema', specialty: 'General Medicine', definition: 'Swelling caused by extra fluid trapped in body tissues, often noticed in the feet, ankles, or legs.' },
  { term: 'Fasting glucose', specialty: 'Endocrinology', definition: 'A blood sugar measurement taken after not eating for a defined period, commonly used in diabetes screening.' },
  { term: 'Hypertension', specialty: 'Cardiology', definition: 'Persistently elevated blood pressure that can increase the risk of heart, brain, kidney, and vascular disease.' },
  { term: 'Inflammation', specialty: 'Immunology', definition: 'The immune system response to injury, infection, or irritation, often causing redness, warmth, swelling, or pain.' },
  { term: 'Jaundice', specialty: 'Hepatology', definition: 'Yellowing of the skin or eyes that may occur when bilirubin builds up in the body.' },
  { term: 'Ketoacidosis', specialty: 'Emergency Medicine', definition: 'A dangerous buildup of acids called ketones, most often associated with uncontrolled diabetes.' },
  { term: 'Lipid panel', specialty: 'Preventive Care', definition: 'A blood test that measures cholesterol and triglycerides to help assess cardiovascular risk.' },
  { term: 'Triage', specialty: 'Emergency Medicine', definition: 'The process of prioritizing patients based on symptom severity and urgency of care needs.' },
];

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function GlossaryPage() {
  const [query, setQuery] = useState('');
  const [letter, setLetter] = useState('All');

  const filteredTerms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return terms.filter((item) => {
      const matchesLetter = letter === 'All' || item.term.startsWith(letter);
      const matchesQuery =
        !normalizedQuery ||
        item.term.toLowerCase().includes(normalizedQuery) ||
        item.definition.toLowerCase().includes(normalizedQuery) ||
        item.specialty.toLowerCase().includes(normalizedQuery);

      return matchesLetter && matchesQuery;
    });
  }, [letter, query]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 px-4 py-8 text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-indigo-100 bg-white p-6 shadow-2xl shadow-indigo-900/10 dark:border-indigo-900/40 dark:bg-slate-950 dark:shadow-black/40 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.32em] text-indigo-700 dark:text-indigo-300">Medical Glossary</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Search clinical terms quickly</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700 dark:text-slate-300">
            Look up common medical vocabulary, lab terms, and care concepts in plain language before a visit or while reviewing health notes.
          </p>
          <div className="mt-8">
            <label htmlFor="glossary-search" className="sr-only">Search glossary</label>
            <input
              id="glossary-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by term, definition, or specialty..."
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-base font-semibold outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {['All', ...alphabet].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLetter(item)}
                className={`h-10 min-w-10 rounded-2xl px-3 text-sm font-black transition ${letter === item ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 dark:bg-indigo-400 dark:text-slate-950' : 'bg-slate-100 text-slate-700 hover:bg-indigo-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-indigo-950'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {filteredTerms.map((item) => (
            <article key={item.term} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-2xl font-black tracking-tight">{item.term}</h2>
                <span className="w-fit rounded-full bg-cyan-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">{item.specialty}</span>
              </div>
              <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{item.definition}</p>
            </article>
          ))}
        </div>

        {filteredTerms.length === 0 && (
          <div className="mt-8 rounded-[2rem] border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-950">
            <p className="text-xl font-black">No matching glossary terms found.</p>
            <p className="mt-2 text-slate-600 dark:text-slate-300">Try another keyword or choose “All” from the A-Z filter.</p>
          </div>
        )}
      </section>
    </main>
  );
}
