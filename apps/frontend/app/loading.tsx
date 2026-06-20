const skeletonCards = Array.from({ length: 6 }, (_, index) => index);

export default function Loading() {
  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-50 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 h-64 animate-pulse rounded-3xl border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-900" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {skeletonCards.map((card) => (
            <div key={card} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-900" />
          ))}
        </div>
      </div>
    </main>
  );
}
