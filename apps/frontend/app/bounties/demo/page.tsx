import MarkdownRenderer from "@/app/components/MarkdownRenderer";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo bounty",
  description:
    "Preview a sample StellarBounty task with markdown requirements, reward details, and submission flow.",
  alternates: {
    canonical: "/bounties/demo",
  },
};

/**
 * Demo bounty page to showcase markdown rendering.
 */
export default function DemoBountyPage() {
  const demoDescription = `## Summary

Build a real bounty listing page that fetches from the backend.

## Acceptance Criteria

- [ ] \`GET /bounties\` fetched server-side
- [ ] Display bounty cards with **title**, reward, deadline
- [ ] Filter by status (open, in-progress, completed)
- [ ] Sort by reward amount or deadline
- [ ] Loading skeleton while fetching
- [ ] Empty state when no bounties match filters

## Tech Notes

- Use \`fetch(\`\${process.env.NEXT_PUBLIC_API_URL}/bounties\`)\`
- Tailwind for styling
- \`@/app/components/BountyCard.tsx\` for individual cards

## Example Output

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique bounty ID |
| title | string | Bounty title |
| reward | number | Reward in XLM |
| status | enum | open, in-progress, completed |
| deadline | date | Submission deadline |

> **Note:** This is a demo page. Backend integration is pending.
`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm mb-6 inline-block">
          &larr; Back to home
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              open
            </span>
            <span className="text-sm text-slate-400">Reward: 500 XLM</span>
            <span className="text-sm text-slate-400">Deadline: 2026-06-18</span>
          </div>
          <h1 className="text-2xl font-bold">Build a bounty listing page</h1>
        </div>

        {/* Markdown rendered description */}
        <div className="bg-slate-900 rounded-lg border border-slate-800">
          <div className="px-4 py-3 border-b border-slate-800 text-sm text-slate-400">
            Description (rendered from Markdown)
          </div>
          <div className="p-6">
            <MarkdownRenderer content={demoDescription} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex gap-3">
          <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
            Claim Bounty
          </button>
          <Link
            href="/bounties/new"
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg border border-slate-700 transition-colors"
          >
            Create New
          </Link>
        </div>
      </div>
    </main>
  );
}
