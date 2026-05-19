import Link from 'next/link';

interface BountyCardProps {
  id: string;
  title: string;
  reward: string;
  deadline: string;
  status: 'open' | 'closed' | 'in_progress';
  tags?: string[];
}

const statusConfig = {
  open: { label: 'Open', className: 'bg-green-900/50 text-green-400 border-green-700' },
  closed: { label: 'Closed', className: 'bg-red-900/50 text-red-400 border-red-700' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-900/50 text-yellow-400 border-yellow-700' },
};

export default function BountyCard({ id, title, reward, deadline, status, tags }: BountyCardProps) {
  const statusInfo = statusConfig[status];
  const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <Link href={`/bounties/${id}`}>
      <div className="group relative bg-slate-800/50 border border-slate-700 rounded-xl p-5 hover:border-yellow-500/50 hover:bg-slate-800/80 transition-all duration-200 cursor-pointer">
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
          {daysLeft > 0 && daysLeft <= 7 && (
            <span className="text-xs text-orange-400 font-medium">
              {daysLeft}d left
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-white font-semibold text-lg mb-2 group-hover:text-yellow-400 transition-colors line-clamp-2">
          {title}
        </h3>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Reward & Deadline */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/50">
          <div className="flex items-center gap-1.5">
            <span className="text-yellow-400 font-bold text-sm">{reward}</span>
            <span className="text-slate-500 text-xs">XLM</span>
          </div>
          <div className="text-slate-500 text-xs">
            {new Date(deadline).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>

        {/* Hover Arrow */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
