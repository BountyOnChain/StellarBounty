export default function BountyDetailSkeleton() {
  return (
    <main className="min-h-[calc(100vh-73px)] overflow-x-hidden bg-slate-50 px-3 py-6 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-4 sm:py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        {/* Main content card */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-slate-950/40 sm:p-6">
          {/* Status badge + meta row */}
          <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="h-6 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Title */}
          <div className="h-10 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800 sm:h-12" />

          {/* Description lines */}
          <div className="mt-5 space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-11/12 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Detail cards grid */}
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
              >
                <div className="h-3 w-12 rounded bg-slate-300 dark:bg-slate-700" />
                <div className="mt-2 h-4 w-28 rounded bg-slate-300 dark:bg-slate-700" />
              </div>
            ))}
          </div>
        </section>

        {/* Sidebar / submit card */}
        <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-slate-950/40 sm:p-6">
          <div className="h-6 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mt-5 space-y-4">
            <div className="h-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="h-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
            <div className="h-11 w-full animate-pulse rounded-lg bg-slate-300 dark:bg-slate-700" />
          </div>
        </aside>
      </div>
    </main>
  );
}