type Article = {
  title: string;
  category: string;
  readTime: string;
  date: string;
  excerpt: string;
};

const articles: Article[] = [
  {
    title: 'Understanding blood pressure readings before your next visit',
    category: 'Cardiology',
    readTime: '5 min read',
    date: 'Clinical update',
    excerpt:
      'A practical guide to systolic, diastolic, and home monitoring trends that patients can discuss with their clinician.',
  },
  {
    title: 'When seasonal allergies mimic a respiratory infection',
    category: 'Primary Care',
    readTime: '4 min read',
    date: 'Health tip',
    excerpt:
      'Learn the common overlap between congestion, cough, and fatigue, plus red flags that deserve medical attention.',
  },
  {
    title: 'Diabetes check-ins: small habits that support glucose stability',
    category: 'Endocrinology',
    readTime: '6 min read',
    date: 'Patient education',
    excerpt:
      'Meal timing, medication adherence, hydration, and activity logs can help patients prepare for more productive appointments.',
  },
  {
    title: 'Antibiotic stewardship for families: what to ask your doctor',
    category: 'Medication Safety',
    readTime: '3 min read',
    date: 'Safety note',
    excerpt:
      'Not every infection needs antibiotics. These questions can help clarify risks, benefits, and follow-up plans.',
  },
  {
    title: 'Sleep and immune resilience: what the evidence suggests',
    category: 'Wellness',
    readTime: '5 min read',
    date: 'Research brief',
    excerpt:
      'Consistent sleep routines may support recovery, mood, and immune function as part of a broader care plan.',
  },
  {
    title: 'Preparing for a telehealth appointment like a pro',
    category: 'Digital Health',
    readTime: '4 min read',
    date: 'Care access',
    excerpt:
      'Gather vitals, medication lists, symptom timelines, and questions before joining a virtual medical visit.',
  },
];

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-emerald-50 px-4 py-8 text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-cyan-100 bg-white/90 p-6 shadow-2xl shadow-cyan-900/10 backdrop-blur dark:border-cyan-900/40 dark:bg-slate-950/90 dark:shadow-black/40 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.32em] text-cyan-700 dark:text-cyan-300">MedIntel Pro Journal</p>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Clinical news & health tips</h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700 dark:text-slate-300">
                Browse practical, patient-friendly medical explainers and care-preparation guides written for a modern digital health workflow.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {articles.length} featured reads
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {articles.map((article) => (
            <article key={article.title} className="group flex min-h-80 flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 transition hover:-translate-y-1 hover:shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-cyan-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">{article.category}</span>
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{article.readTime}</span>
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-950 group-hover:text-cyan-700 dark:text-white dark:group-hover:text-cyan-300">{article.title}</h2>
              <p className="mt-3 text-sm font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{article.date}</p>
              <p className="mt-4 flex-1 text-base leading-7 text-slate-600 dark:text-slate-300">{article.excerpt}</p>
              <button type="button" className="mt-6 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-500/30 dark:bg-white dark:text-slate-950 dark:hover:bg-cyan-200">
                Read More
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
