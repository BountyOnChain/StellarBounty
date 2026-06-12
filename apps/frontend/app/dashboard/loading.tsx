export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 h-8 w-44 animate-pulse rounded bg-slate-800" />
      <div className="mb-6 flex gap-3 border-b border-slate-700 pb-3">
        <div className="h-8 w-32 animate-pulse rounded bg-slate-800" />
        <div className="h-8 w-28 animate-pulse rounded bg-slate-800" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-12 animate-pulse rounded bg-slate-800" />
        ))}
      </div>
    </main>
  );
}
