export default function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-5xl bg-slate-50 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
      {/* Title */}
      <div className="mb-6 h-8 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />

      {/* Tabs */}
      <div className="mb-6 flex border-b border-slate-300 dark:border-slate-700">
        <div className="h-10 w-32 animate-pulse rounded-t bg-slate-200 dark:bg-slate-800" />
        <div className="ml-2 h-10 w-28 animate-pulse rounded-t bg-slate-200 dark:bg-slate-800" />
      </div>

      {/* Table rows */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex animate-pulse items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/50"
          >
            <div className="h-4 flex-1 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </main>
  );
}