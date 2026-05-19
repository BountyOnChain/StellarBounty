export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold">StellarBounty</h1>
        <p className="mt-3 text-slate-400">Decentralized bounty marketplace on Stellar.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a className="rounded border border-cyan-300 px-4 py-2 text-cyan-200 hover:bg-cyan-300 hover:text-slate-950" href="/bounties/new">
            Create bounty
          </a>
          <a className="rounded border border-slate-700 px-4 py-2 text-slate-200 hover:border-slate-500" href="/bounties/demo">
            View bounty
          </a>
        </div>
      </div>
    </main>
  );
}
