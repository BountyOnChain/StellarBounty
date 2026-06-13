"use client";

import { useI18n } from "../lib/i18n";

type StatusVariant = "pending" | "approved" | "rejected" | "open" | "in_progress" | "completed" | "cancelled";

const STATUS_STYLES: Record<StatusVariant, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  approved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/20 text-red-400 border-red-500/30",
  open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  in_progress: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  cancelled: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

interface StatusBadgeProps {
  status: StatusVariant;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useI18n();
  const baseClass = STATUS_STYLES[status] ?? "bg-slate-500/20 text-slate-400 border-slate-500/30";

  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded border ${baseClass} ${className ?? ""}`}
    >
      {t(`status.${status}`)}
    </span>
  );
}
