"use client";

import { useState } from "react";
import { MarkdownRenderer } from "../../../components/MarkdownRenderer";

const initialDescription = `## Scope

- Build a focused contribution
- Include validation steps
- Keep the pull request easy to review

**Reward:** 250 XLM`;

export default function CreateBountyPage() {
  const [description, setDescription] = useState(initialDescription);
  const [activeTab, setActiveTab] = useState<"write" | "preview">("write");

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <section className="mx-auto max-w-3xl">
        <a href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
          StellarBounty
        </a>
        <div className="mt-8 border-b border-slate-800 pb-6">
          <p className="text-sm uppercase tracking-wide text-slate-500">Create bounty</p>
          <h1 className="mt-2 text-3xl font-semibold">New bounty</h1>
        </div>
        <form className="mt-8 space-y-6">
          <label className="block">
            <span className="text-sm font-medium text-slate-300">Title</span>
            <input
              className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none transition focus:border-cyan-300"
              defaultValue="Improve bounty description rendering"
            />
          </label>
          <section>
            <div className="flex border-b border-slate-800">
              <button
                className={`px-4 py-2 text-sm font-medium ${activeTab === "write" ? "border-b-2 border-cyan-300 text-cyan-200" : "text-slate-400"}`}
                onClick={() => setActiveTab("write")}
                type="button"
              >
                Write
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${activeTab === "preview" ? "border-b-2 border-cyan-300 text-cyan-200" : "text-slate-400"}`}
                onClick={() => setActiveTab("preview")}
                type="button"
              >
                Preview
              </button>
            </div>
            {activeTab === "write" ? (
              <textarea
                className="mt-4 min-h-72 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 outline-none transition focus:border-cyan-300"
                onChange={(event) => setDescription(event.target.value)}
                value={description}
              />
            ) : (
              <div className="mt-4 min-h-72 rounded border border-slate-800 bg-slate-900 p-4">
                <MarkdownRenderer content={description} />
              </div>
            )}
          </section>
        </form>
      </section>
    </main>
  );
}
