import { cn } from "@/lib/utils";

type StatusVariant =
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show"
  | "pending"
  | "cleared"
  | "reconciled"
  | "void"
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "income"
  | "expense"
  | "imported"
  | "disputed"
  | string;

const variantStyles: Record<string, string> = {
  confirmed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  checked_in: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  checked_out: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  no_show: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  cleared: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  reconciled: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  void: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  overdue: "bg-red-500/10 text-red-400 border-red-500/20",
  income: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  expense: "bg-red-500/10 text-red-400 border-red-500/20",
  imported: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  disputed: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const defaultStyle = "bg-gray-500/10 text-gray-400 border-gray-500/20";

const labelMap: Record<string, string> = {
  checked_in: "Checked In",
  checked_out: "Checked Out",
  no_show: "No Show",
};

interface StatusBadgeProps {
  status: StatusVariant;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const style = variantStyles[key] ?? defaultStyle;
  const label = labelMap[key] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
      style,
      className
    )}>
      {label}
    </span>
  );
}
