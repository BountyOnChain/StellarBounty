"use client";

import Link from "next/link";
import { useI18n } from "../../lib/i18n";

type BountyFiltersProps = {
  search: string;
  status: string;
  sort: string;
  visibleCount: number;
  totalCount: number;
};

export default function BountyFilters({
  search,
  status,
  sort,
  visibleCount,
  totalCount,
}: BountyFiltersProps) {
  const { t } = useI18n();

  return (
    <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl shadow-black/10 sm:p-6">
      <form className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(180px,0.8fr)_minmax(180px,0.8fr)_auto] md:items-end">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">{t("home.searchTitle")}</span>
          <input
            type="search"
            name="search"
            defaultValue={search}
            placeholder={t("home.searchPlaceholder")}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-yellow-400"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">{t("home.status")}</span>
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-yellow-400"
          >
            <option value="all">{t("filters.allStatuses")}</option>
            <option value="open">{t("filters.open")}</option>
            <option value="in_progress">{t("filters.inProgress")}</option>
            <option value="completed">{t("filters.completed")}</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">{t("home.sortBy")}</span>
          <select
            name="sort"
            defaultValue={sort}
            className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-yellow-400"
          >
            <option value="newest">{t("sort.newest")}</option>
            <option value="highest_reward">{t("sort.highestReward")}</option>
            <option value="closest_deadline">{t("sort.closestDeadline")}</option>
          </select>
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="inline-flex min-w-28 items-center justify-center rounded-2xl bg-yellow-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-yellow-300"
          >
            {t("home.apply")}
          </button>
          <Link
            href="/"
            className="inline-flex min-w-28 items-center justify-center rounded-2xl border border-slate-700 px-5 py-3 font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            {t("home.reset")}
          </Link>
        </div>
      </form>

      <div className="mt-4 flex flex-col gap-2 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>{t("home.showing", { visible: visibleCount, total: totalCount })}</p>
        <p className="text-slate-500">{t("home.filtersShareable")}</p>
      </div>
    </section>
  );
}
