import SkeletonCardList from '@/components/SkeletonCard';

export default function Loading() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-slate-100 px-4 py-10 text-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950 dark:text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-3xl border border-white/70 bg-white/80 p-8 shadow-2xl shadow-cyan-900/10 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/80 dark:shadow-black/30">
          <div className="h-4 w-56 animate-pulse rounded-full bg-cyan-100 dark:bg-cyan-900/50" />
          <div className="mt-5 h-12 w-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="mt-5 h-5 max-w-3xl animate-pulse rounded-full bg-slate-100 dark:bg-slate-900" />
          <div className="mt-3 h-5 max-w-2xl animate-pulse rounded-full bg-slate-100 dark:bg-slate-900" />
        </div>
        <SkeletonCardList count={6} variant="drug" />
      </section>
    </main>
  );
}
