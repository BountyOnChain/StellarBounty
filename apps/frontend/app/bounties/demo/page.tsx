import type { Metadata } from "next";
import MarkdownRenderer from "@/app/components/MarkdownRenderer";
import Link from "next/link";
import { absoluteUrl, siteName } from "../../seo";

const description = "Preview a StellarBounty listing page with markdown requirements and bounty details.";

export const metadata: Metadata = {
  title: "Demo Bounty",
  description,
  alternates: {
    canonical: absoluteUrl("/bounties/demo"),
  },
  openGraph: {
    title: `Demo Bounty | ${siteName}`,
    description,
    url: absoluteUrl("/bounties/demo"),
    type: "article",
  },
  twitter: {
    card: "summary",
    title: `Demo Bounty | ${siteName}`,
    description,
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

- Use \`fetch(\`\${process.env.NEXT_PUBLIC_API_URL}/api/v1/bounties\`)\`
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
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
        {/* Back link */}
        <Link href="/" className="mb-6 inline-flex min-h-11 items-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
          &larr; Back to home
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <span className="w-fit rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
              open
            </span>
            <span className="break-words text-sm text-slate-600 dark:text-slate-400">Reward: 500 XLM</span>
            <span className="break-words text-sm text-slate-600 dark:text-slate-400">Deadline: 2026-06-18</span>
          </div>
          <h1 className="break-words text-2xl font-bold">Build a bounty listing page</h1>
        </div>

        {/* Markdown rendered description */}
        <div className="min-w-0 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
            Description (rendered from Markdown)
          </div>
          <div className="min-w-0 p-4 sm:p-6">
            <MarkdownRenderer content={demoDescription} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button className="min-h-11 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700">
            Claim Bounty
          </button>
          <Link
            href="/bounties/new"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Create New
          </Link>
        </div>
      </div>
    </main>
  );
}
