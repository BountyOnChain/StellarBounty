export default function BountyListSkeleton() {
  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-50 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Hero banner */}
        <div className="mb-10 flex flex-col justify-between gap-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-2xl shadow-slate-200/70 transition-colors dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 dark:shadow-black/20 sm:p-8 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-300 dark:bg-slate-700" />
            <div className="mt-4 h-10 w-96 animate-pulse rounded bg-slate-300 dark:bg-slate-700 sm:h-12" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full max-w-lg animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-4 w-3/4 max-w-md animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            </div>
          </div>
          <div className="h-12 w-36 animate-pulse rounded-xl bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Search / filter bar */}
        <div className="mb-8 animate-pulse rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900/80 dark:shadow-black/10 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.6fr_0.8fr_0.8fr_auto]">
            <div className="h-12 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-12 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-12 rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-12 w-28 rounded-2xl bg-slate-300 dark:bg-slate-700" />
          </div>
          <div className="mt-4 h-4 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>

        {/* Bounty grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-black/10"
            >
              {/* Card header */}
              <div className="flex items-center gap-2">
                <div className="h-5 w-16 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
              {/* Card title */}
              <div className="mt-3 space-y-2">
                <div className="h-5 w-full rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
              {/* Card footer */}
              <div className="mt-4 flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-16 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}