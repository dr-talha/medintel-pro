type SkeletonCardProps = {
  count?: number;
  variant?: 'drug' | 'stat';
};

function SkeletonCard({ variant = 'drug' }: Pick<SkeletonCardProps, 'variant'>) {
  const isStat = variant === 'stat';

  return (
    <article className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30">
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.1s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10" />
      <div className="animate-pulse space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="h-3 w-24 rounded-full bg-cyan-100 dark:bg-cyan-900/50" />
            <div className="h-6 w-48 rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-900" />
        </div>

        <div className="space-y-3">
          <div className="h-4 w-full rounded-full bg-slate-100 dark:bg-slate-900" />
          <div className="h-4 w-11/12 rounded-full bg-slate-100 dark:bg-slate-900" />
          <div className="h-4 w-2/3 rounded-full bg-slate-100 dark:bg-slate-900" />
        </div>

        <div className={isStat ? 'grid grid-cols-3 gap-3' : 'flex flex-wrap gap-2'}>
          {[0, 1, 2].map((item) => (
            <div key={item} className={isStat ? 'h-16 rounded-2xl bg-slate-100 dark:bg-slate-900' : 'h-8 w-24 rounded-full bg-slate-100 dark:bg-slate-900'} />
          ))}
        </div>
      </div>
    </article>
  );
}

export default function SkeletonCardList({ count = 3, variant = 'drug' }: SkeletonCardProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading medical data">
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} variant={variant} />
      ))}
    </div>
  );
}
