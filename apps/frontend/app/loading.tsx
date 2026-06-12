import { BountyGridSkeleton } from "@/app/components/AsyncStates";

export default function Loading() {
  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 h-64 animate-pulse rounded-3xl border border-slate-800 bg-slate-900" />
        <BountyGridSkeleton />
      </div>
    </main>
  );
}
