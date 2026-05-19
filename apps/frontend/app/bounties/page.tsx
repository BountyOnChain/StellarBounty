import Link from 'next/link';
import BountyCard from '../../components/BountyCard';

interface Bounty {
  id: string;
  title: string;
  reward: string;
  deadline: string;
  status: 'open' | 'closed' | 'in_progress';
  tags?: string[];
}

async function getBounties(): Promise<Bounty[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/bounties`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function BountyGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 animate-pulse">
          <div className="h-4 w-16 bg-slate-700 rounded-full mb-3" />
          <div className="h-6 bg-slate-700 rounded mb-2" />
          <div className="h-6 w-3/4 bg-slate-700 rounded mb-4" />
          <div className="flex gap-1.5 mb-3">
            <div className="h-4 w-12 bg-slate-700 rounded" />
            <div className="h-4 w-16 bg-slate-700 rounded" />
          </div>
          <div className="h-px bg-slate-700/50 mb-3" />
          <div className="flex justify-between">
            <div className="h-4 w-20 bg-slate-700 rounded" />
            <div className="h-4 w-16 bg-slate-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
        <svg className="w-8 h-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-slate-300 mb-1">No bounties yet</h3>
      <p className="text-slate-500 text-sm">Be the first to create a bounty!</p>
    </div>
  );
}

export default async function BountiesPage() {
  const bounties = await getBounties();

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Bounties</h1>
              <p className="text-slate-400 mt-1">Discover and contribute to open bounties</p>
            </div>
            <Link
              href="/bounties/create"
              className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Bounty
            </Link>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {bounties.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bounties.map((bounty) => (
              <BountyCard key={bounty.id} {...bounty} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
