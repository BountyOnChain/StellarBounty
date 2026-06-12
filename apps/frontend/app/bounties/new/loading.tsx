export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 h-8 w-56 animate-pulse rounded bg-slate-800" />
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-lg bg-slate-900" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="h-20 animate-pulse rounded-lg bg-slate-900" />
            <div className="h-20 animate-pulse rounded-lg bg-slate-900" />
          </div>
          <div className="h-72 animate-pulse rounded-lg bg-slate-900" />
        </div>
      </div>
    </main>
  );
}
