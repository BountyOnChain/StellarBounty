"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export type BountyStatusCounts = {
  open: number;
  in_progress: number;
  completed: number;
  cancelled: number;
};

type BountySearchInputProps = {
  initialSearch: string;
  statusCounts: BountyStatusCounts;
};

export default function BountySearchInput({ initialSearch, statusCounts }: BountySearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebouncedValue(search, 300);
  const searchParamsString = searchParams.toString();
  const latestSearch = useRef(initialSearch);
  const pendingInternalNavigations = useRef(new Set<string>());
  const externalSyncTarget = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const urlSearch = params.get("q") ?? params.get("search") ?? "";

    if (pendingInternalNavigations.current.delete(urlSearch)) {
      return;
    }

    // A different URL value came from browser navigation or another external
    // source. Mark it while the controlled input catches up so its older
    // debounced value cannot immediately replace the external URL.
    if (latestSearch.current !== urlSearch) {
      externalSyncTarget.current = urlSearch;
      latestSearch.current = urlSearch;
      setSearch(urlSearch);
    }
  }, [searchParamsString]);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const currentSearch = params.get("q") ?? params.get("search") ?? "";

    if (externalSyncTarget.current !== null) {
      if (debouncedSearch === externalSyncTarget.current) {
        externalSyncTarget.current = null;
      }
      return;
    }

    if (debouncedSearch === currentSearch) return;

    params.delete("search");
    if (debouncedSearch) {
      params.set("q", debouncedSearch);
    } else {
      params.delete("q");
    }
    params.delete("page");

    const query = params.toString();
    pendingInternalNavigations.current.add(debouncedSearch);
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [debouncedSearch, pathname, router, searchParamsString]);

  return (
    <div>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Search title</span>
        <input
          type="search"
          name="q"
          value={search}
          onChange={(event) => {
            externalSyncTarget.current = null;
            latestSearch.current = event.target.value;
            setSearch(event.target.value);
          }}
          placeholder="Search bounty titles"
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-amber-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-yellow-400"
        />
      </label>
      <div aria-live="polite" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
        <span>Open: {statusCounts.open}</span>
        <span>In progress: {statusCounts.in_progress}</span>
        <span>Completed: {statusCounts.completed}</span>
        <span>Cancelled: {statusCounts.cancelled}</span>
      </div>
    </div>
  );
}
