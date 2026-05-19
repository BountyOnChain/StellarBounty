import Link from 'next/link';
import { notFound } from 'next/navigation';
import SubmitWorkForm from '../../../components/SubmitWorkForm';

interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: string;
  deadline: string;
  status: 'open' | 'closed' | 'in_progress';
  ownerAddress: string;
  tags?: string[];
}

async function getBounty(id: string): Promise<Bounty | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/bounties/${id}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    open: { label: 'Open', className: 'bg-green-900/50 text-green-400 border-green-700' },
    closed: { label: 'Closed', className: 'bg-red-900/50 text-red-400 border-red-700' },
    in_progress: { label: 'In Progress', className: 'bg-yellow-900/50 text-yellow-400 border-yellow-700' },
  };
  const info = config[status] || { label: status, className: 'bg-slate-700 text-slate-400 border-slate-600' };

  return (
    <span className={`text-sm font-medium px-3 py-1 rounded-full border ${info.className}`}>
      {info.label}
    </span>
  );
}

export default async function BountyDetailPage({ params }: { params: { id: string } }) {
  const bounty = await getBounty(params.id);

  if (!bounty) {
    notFound();
  }

  const daysLeft = Math.ceil((new Date(bounty.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Back Link */}
      <div className="border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/bounties"
            className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to bounties
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title & Status */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <StatusBadge status={bounty.status} />
                {daysLeft > 0 && daysLeft <= 7 && (
                  <span className="text-sm text-orange-400 font-medium">• {daysLeft} days left</span>
                )}
              </div>
              <h1 className="text-3xl font-bold text-white">{bounty.title}</h1>
            </div>

            {/* Tags */}
            {bounty.tags && bounty.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {bounty.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-sm text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-3">Description</h2>
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{bounty.description}</p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Reward Card */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Reward</h3>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold text-yellow-400">{bounty.reward}</span>
                <span className="text-slate-500">XLM</span>
              </div>
            </div>

            {/* Details Card */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-medium text-slate-400">Details</h3>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Owner</p>
                <p className="text-sm text-slate-300 font-mono" title={bounty.ownerAddress}>
                  {formatAddress(bounty.ownerAddress)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Deadline</p>
                <p className="text-sm text-slate-300">
                  {new Date(bounty.deadline).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Submit Work Form */}
            <SubmitWorkForm
              bountyId={bounty.id}
              isAuthenticated={false}
              bountyStatus={bounty.status}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
