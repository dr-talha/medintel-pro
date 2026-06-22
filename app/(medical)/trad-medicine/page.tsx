type Herb = {
  name: string;
  region: string;
  traditionalUses: string[];
  potentialBenefits: string;
  caution: string;
};

const herbs: Herb[] = [
  {
    name: 'Ashwagandha',
    region: 'Ayurvedic adaptogen',
    traditionalUses: ['Stress support', 'Sleep routines', 'General vitality'],
    potentialBenefits: 'Traditionally used to support calm, rest, and resilience as part of broader lifestyle care.',
    caution: 'May interact with sedatives, thyroid medicines, immune therapies, or pregnancy-related care plans.',
  },
  {
    name: 'Neem',
    region: 'South Asian botanical',
    traditionalUses: ['Skin care traditions', 'Oral hygiene', 'Household wellness rituals'],
    potentialBenefits: 'Often used topically or in hygiene practices; internal use requires extra caution and professional guidance.',
    caution: 'Neem oil and concentrated extracts can be unsafe, especially for children, pregnancy, liver disease, or kidney disease.',
  },
  {
    name: 'Turmeric',
    region: 'Desi kitchen medicine',
    traditionalUses: ['Joint comfort', 'Digestive support', 'Golden milk preparations'],
    potentialBenefits: 'Contains curcumin, a compound studied for inflammatory pathways, though food use differs from high-dose supplements.',
    caution: 'High-dose supplements may affect blood thinners, gallbladder disease, reflux, or upcoming surgery plans.',
  },
  {
    name: 'Tulsi',
    region: 'Holy basil',
    traditionalUses: ['Tea for seasonal wellness', 'Throat comfort', 'Breathing support rituals'],
    potentialBenefits: 'Commonly prepared as tea for comfort during seasonal changes and daily wellness routines.',
    caution: 'Use caution with blood sugar medications, anticoagulants, fertility treatment, pregnancy, or breastfeeding.',
  },
  {
    name: 'Ginger',
    region: 'Kitchen and Unani traditions',
    traditionalUses: ['Nausea comfort', 'Digestive warmth', 'Cold-weather teas'],
    potentialBenefits: 'Food-level ginger is commonly used for digestive comfort and nausea support in many cultures.',
    caution: 'Large doses may worsen reflux or interact with blood thinners and diabetes or blood pressure medicines.',
  },
  {
    name: 'Ajwain',
    region: 'Carom seed remedy',
    traditionalUses: ['Bloating', 'Post-meal tea', 'Digestive discomfort'],
    potentialBenefits: 'Traditionally used in small culinary amounts to support digestion after heavy meals.',
    caution: 'Concentrated oils or high intake may irritate the stomach and are not appropriate for all pregnancy or ulcer histories.',
  },
];

export default function TraditionalMedicinePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-emerald-50 px-4 py-8 text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] border border-amber-100 bg-white p-6 shadow-2xl shadow-amber-900/10 dark:border-amber-900/40 dark:bg-slate-950 dark:shadow-black/40 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.32em] text-emerald-700 dark:text-emerald-300">Traditional & Herbal Medicine</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Eastern and Desi remedy directory</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-700 dark:text-slate-300">
            Explore common herbs used in South Asian, Ayurvedic, Unani, and household traditions with safety-first clinical context.
          </p>
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold leading-7 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100">
            Strict medical disclaimer: this directory is educational only and is not medical advice. Herbal products can cause side effects, allergic reactions, toxicity, and drug interactions. Always consult a licensed doctor, pharmacist, or qualified clinician before using any remedy, especially during pregnancy, breastfeeding, chronic illness, surgery planning, or prescription medication use.
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {herbs.map((herb) => (
            <article key={herb.name} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30">
              <span className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{herb.region}</span>
              <h2 className="mt-5 text-3xl font-black tracking-tight">{herb.name}</h2>
              <p className="mt-4 text-base font-bold text-slate-700 dark:text-slate-200">Traditional uses</p>
              <ul className="mt-3 space-y-2">
                {herb.traditionalUses.map((use) => (
                  <li key={use} className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    {use}
                  </li>
                ))}
              </ul>
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <p className="text-sm font-black uppercase tracking-wide text-emerald-800 dark:text-emerald-200">Potential benefit context</p>
                <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{herb.potentialBenefits}</p>
              </div>
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                <p className="text-sm font-black uppercase tracking-wide text-red-800 dark:text-red-200">Consult a doctor before use</p>
                <p className="mt-2 text-sm leading-6 text-red-900 dark:text-red-100">{herb.caution}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
