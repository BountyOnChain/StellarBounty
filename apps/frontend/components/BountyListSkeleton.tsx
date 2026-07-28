export default function BountyListSkeleton() {
  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-50 px-4 py-10 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Hero section skeleton */}
        <section className="mb-10 flex flex-col justify-between gap-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-2xl shadow-slate-200/70 transition-colors dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 dark:shadow-black/20 sm:p-8 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="mb-4 h-4 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mb-4 h-10 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700 sm:h-12" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>
          <div className="h-12 w-36 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />
        </section>

        {/* Filters skeleton */}
        <section className="mb-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 transition-colors dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/10 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)_auto] md:items-end">
            <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
            <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
            <div className="h-12 w-full animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
            <div className="flex gap-3">
              <div className="h-12 w-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
              <div className="h-12 w-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        </section>

        {/* Bounty cards grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 p-5 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="flex items-start justify-between">
                <div className="h-4 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="h-4 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              </div>
              <div className="mt-4 h-5 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-2 h-4 w-3/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-6 flex items-center gap-4">
                <div className="h-3 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}