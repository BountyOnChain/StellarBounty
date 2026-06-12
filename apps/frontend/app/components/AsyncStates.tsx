import Link from "next/link";

type RetryLinkProps = {
  href: string;
  label?: string;
};

export function ErrorState({
  title,
  message,
  retry,
}: {
  title: string;
  message: string;
  retry?: RetryLinkProps;
}) {
  return (
    <section className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-center">
      <h2 className="text-lg font-semibold text-red-100">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-red-100/80">{message}</p>
      {retry ? (
        <Link
          href={retry.href}
          className="mt-5 inline-flex rounded-xl border border-red-300/40 px-4 py-2 text-sm font-medium text-red-50 transition hover:border-red-200 hover:bg-red-400/10"
        >
          {retry.label ?? "Try again"}
        </Link>
      ) : null}
    </section>
  );
}

export function BountyCardSkeleton() {
  return (
    <div className="h-44 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80">
      <div className="space-y-4 p-5">
        <div className="h-4 w-3/4 rounded bg-slate-800" />
        <div className="h-4 w-1/3 rounded bg-slate-800" />
        <div className="mt-8 flex justify-between">
          <div className="h-8 w-24 rounded bg-slate-800" />
          <div className="h-8 w-20 rounded bg-slate-800" />
        </div>
      </div>
    </div>
  );
}

export function BountyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <BountyCardSkeleton key={index} />
      ))}
    </section>
  );
}

export function BountyDetailSkeleton() {
  return (
    <main className="min-h-[calc(100vh-73px)] bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_380px]">
        <section className="h-[420px] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80" />
        <aside className="h-[360px] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80" />
      </div>
    </main>
  );
}
