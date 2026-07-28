export default function BountyDetailSkeleton() {
  return (
    <main className="min-h-[calc(100vh-73px)] overflow-x-hidden bg-slate-50 px-3 py-6 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-4 sm:py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        {/* Main content skeleton */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-slate-950/40 sm:p-6">
          {/* Badge + metadata row */}
          <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Title */}
          <div className="mb-4 h-8 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-700 sm:h-10" />
          <div className="mb-2 h-8 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-slate-700 sm:h-10" />

          {/* Description */}
          <div className="mt-5 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>

          {/* Info cards */}
          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
              >
                <div className="h-3 w-12 animate-pulse rounded bg-slate-300 dark:bg-slate-600" />
                <div className="mt-2 h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            ))}
          </dl>
        </section>

        {/* Sidebar skeleton */}
        <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-slate-950/40 sm:p-6">
          {/* Title */}
          <div className="h-6 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-2 h-4 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />

          {/* Form fields */}
          <div className="mt-5 space-y-4">
            <div className="h-12 w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="h-32 w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          </div>
        </aside>
      </div>
    </main>
  );
}