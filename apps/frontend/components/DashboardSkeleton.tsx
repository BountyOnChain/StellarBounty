export default function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-5xl bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      <div className="mb-6 h-8 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />

      {/* Tabs */}
      <div className="mb-6 flex border-b border-slate-300 dark:border-slate-700">
        {["submissions", "bounties"].map((tab) => (
          <div
            key={tab}
            className="h-10 w-32 animate-pulse rounded-t bg-slate-200 dark:bg-slate-700"
            style={{ marginRight: tab === "submissions" ? 4 : 0 }}
          />
        ))}
      </div>

      {/* Table header */}
      <div className="mb-3 flex gap-4">
        <div className="h-4 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Table rows */}
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded border-b border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60"
          style={{ marginBottom: 4 }}
        />
      ))}
    </main>
  );
}