"use client";

import { FormEvent, useMemo, useState } from "react";
import { useWallet } from "@/components/WalletContext";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/toast/ToastProvider";
import { useAuth } from "@/lib/api";

type Bounty = {
  id: string;
  title: string;
  description: string;
  reward: string;
  deadline: string;
  status: "open" | "in-progress" | "in_progress" | "completed" | "cancelled";
  ownerAddress: string;
};

function truncateAddress(address: string) {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export default function BountyDetailClient({ bounty }: { bounty: Bounty }) {
  const { publicKey } = useWallet();
  const toast = useToast();
  const { getToken, clearToken, apiUrl } = useAuth();
  const [workLink, setWorkLink] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = bounty.status === "open";
  const canSubmit = Boolean(publicKey) && isOpen;
  const disabledReason = useMemo(() => {
    if (!isOpen) return "Submissions are closed for this bounty.";
    if (!publicKey) return "Connect your wallet to submit work.";
    return null;
  }, [isOpen, publicKey]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      toast.error(disabledReason || "Submission is disabled.");
      return;
    }

    setIsSubmitting(true);

    try {
      const accessToken = await getToken(publicKey as string);
      const response = await fetch(`${apiUrl}/api/v1/bounties/${bounty.id}/submissions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ link: workLink, notes, submitter: publicKey }),
      });

      if (!response.ok) {
        if (response.status === 401) clearToken();
        throw new Error("Submission failed. Please try again.");
      }

      setWorkLink("");
      setNotes("");
      toast.success("Work submitted successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusKey = bounty.status.replace(/-/g, "_") as
    | "open"
    | "in_progress"
    | "completed"
    | "cancelled";

  return (
    <main className="min-h-[calc(100vh-73px)] overflow-x-hidden bg-slate-950 px-3 py-6 text-slate-100 sm:px-4 sm:py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        <section className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-slate-950/40 sm:p-6">
          <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <StatusBadge status={statusKey} />
            <span className="break-words text-sm text-slate-400">Reward: {bounty.reward}</span>
            <span className="break-words text-sm text-slate-400">Deadline: {bounty.deadline}</span>
          </div>

          <h1 className="break-words text-2xl font-bold tracking-tight text-white sm:text-4xl">
            {bounty.title}
          </h1>
          <p className="mt-5 whitespace-pre-line break-words text-base leading-7 text-slate-300">
            {bounty.description}
          </p>

          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Owner</dt>
              <dd className="mt-2 break-all font-mono text-sm text-slate-200">
                {truncateAddress(bounty.ownerAddress)}
              </dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Reward</dt>
              <dd className="mt-2 break-words text-sm font-semibold text-slate-200">{bounty.reward}</dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
              <dd className="mt-2 text-sm font-semibold capitalize text-slate-200">
                {bounty.status}
              </dd>
            </div>
          </dl>
        </section>

        <aside className="min-w-0 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-2xl shadow-slate-950/40 sm:p-6">
          <h2 className="text-xl font-semibold text-white">Submit work</h2>
          <p className="mt-2 text-sm text-slate-400">
            Share a PR, demo, or document link with implementation notes.
          </p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-300">Work link</span>
              <input
                required
                type="url"
                value={workLink}
                onChange={(e) => setWorkLink(e.target.value)}
                disabled={!canSubmit || isSubmitting}
                placeholder="https://github.com/..."
                className="mt-2 min-h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-300">Notes</span>
              <textarea
                required
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={!canSubmit || isSubmitting}
                rows={5}
                placeholder="Summarize the work and verification steps."
                className="mt-2 min-h-32 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none transition focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>

            {disabledReason && <p className="text-sm text-amber-300">{disabledReason}</p>}

            <button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="min-h-11 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isSubmitting ? "Submitting..." : "Submit work"}
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}
