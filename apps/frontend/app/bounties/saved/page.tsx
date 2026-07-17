"use client";

import SavedBountiesList from "../components/SavedBountiesList";

export default function SavedPage() {
  return (
    <main className="mx-auto max-w-7xl bg-slate-50 px-4 py-10 text-slate-950 dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Saved Bounties</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Bounties you&apos;ve bookmarked for later.
        </p>
      </div>
      <SavedBountiesList />
    </main>
  );
}