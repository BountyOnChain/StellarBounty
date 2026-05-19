import { MarkdownRenderer } from "../../../components/MarkdownRenderer";

const bounty = {
  title: "Add markdown rendering for bounty descriptions",
  reward: "250 XLM",
  description: `## Requirements

- Render **GitHub-flavored markdown**
- Support task lists and tables
- Keep external links readable
- Avoid raw HTML injection

| Deliverable | Status |
| --- | --- |
| Detail view | Ready |
| Preview tab | Ready |

See the [Stellar docs](https://developers.stellar.org/) for network context.`,
};

export default function BountyDetailPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <section className="mx-auto max-w-3xl">
        <a href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
          StellarBounty
        </a>
        <div className="mt-8 flex flex-col gap-3 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-500">Bounty</p>
            <h1 className="mt-2 text-3xl font-semibold">{bounty.title}</h1>
          </div>
          <p className="text-lg font-semibold text-emerald-300">{bounty.reward}</p>
        </div>
        <section className="mt-8">
          <MarkdownRenderer content={bounty.description} />
        </section>
      </section>
    </main>
  );
}
