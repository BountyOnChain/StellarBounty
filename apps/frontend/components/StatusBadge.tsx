"use client";

type StatusVariant = "pending" | "approved" | "rejected" | "open" | "in_progress" | "completed" | "cancelled";

const STATUS_STYLES: Record<StatusVariant, string> = {
  pending: "border-yellow-500/30 bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300",
  approved: "border-emerald-500/30 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  rejected: "border-red-500/30 bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
  open: "border-blue-500/30 bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  in_progress: "border-purple-500/30 bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300",
  completed: "border-emerald-500/30 bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  cancelled: "border-slate-500/30 bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
};

interface StatusBadgeProps {
  status: StatusVariant;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const baseClass = STATUS_STYLES[status] ?? "border-slate-500/30 bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300";

  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded border ${baseClass} ${className ?? ""}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
