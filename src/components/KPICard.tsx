import { cn } from "@/lib/utils";

type Accent = "emerald" | "blue" | "gold" | "rose" | "purple" | "default";

interface KPICardProps {
  label: string;
  value: string;
  subValue?: string;
  change?: number;
  icon?: React.ReactNode;
  accent?: Accent;
  className?: string;
  featured?: boolean; // bigger, more prominent
}

const ACCENT_MAP: Record<Accent, {
  iconBg: string; iconText: string;
  valueCls: string;
  badgePos: string; badgeNeg: string;
  glow: string;
  topBar: string;
}> = {
  emerald: {
    iconBg: "bg-emerald-500/15",
    iconText: "text-emerald-400",
    valueCls: "gradient-text",
    badgePos: "bg-emerald-500/10 text-emerald-400",
    badgeNeg: "bg-red-500/10 text-red-400",
    glow: "glow-emerald",
    topBar: "from-emerald-500/30 to-transparent",
  },
  blue: {
    iconBg: "bg-blue-500/15",
    iconText: "text-blue-400",
    valueCls: "gradient-text-blue",
    badgePos: "bg-emerald-500/10 text-emerald-400",
    badgeNeg: "bg-red-500/10 text-red-400",
    glow: "glow-blue",
    topBar: "from-blue-500/30 to-transparent",
  },
  gold: {
    iconBg: "bg-amber-500/15",
    iconText: "text-amber-400",
    valueCls: "gradient-text-gold",
    badgePos: "bg-emerald-500/10 text-emerald-400",
    badgeNeg: "bg-red-500/10 text-red-400",
    glow: "glow-gold",
    topBar: "from-amber-500/30 to-transparent",
  },
  rose: {
    iconBg: "bg-rose-500/15",
    iconText: "text-rose-400",
    valueCls: "gradient-text-rose",
    badgePos: "bg-emerald-500/10 text-emerald-400",
    badgeNeg: "bg-red-500/10 text-red-400",
    glow: "glow-rose",
    topBar: "from-rose-500/30 to-transparent",
  },
  purple: {
    iconBg: "bg-purple-500/15",
    iconText: "text-purple-400",
    valueCls: "text-white",
    badgePos: "bg-emerald-500/10 text-emerald-400",
    badgeNeg: "bg-red-500/10 text-red-400",
    glow: "",
    topBar: "from-purple-500/30 to-transparent",
  },
  default: {
    iconBg: "bg-gray-800",
    iconText: "text-gray-400",
    valueCls: "text-white",
    badgePos: "bg-emerald-500/10 text-emerald-400",
    badgeNeg: "bg-red-500/10 text-red-400",
    glow: "",
    topBar: "from-gray-700/30 to-transparent",
  },
};

export function KPICard({ label, value, subValue, change, icon, accent = "default", className, featured }: KPICardProps) {
  const a = ACCENT_MAP[accent];
  const isPositive = change !== undefined && change >= 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl p-5 transition-all duration-200 cursor-default",
      "glass",
      "hover:border-white/10 hover:-translate-y-0.5",
      featured && a.glow,
      className
    )}>
      {/* Subtle top gradient accent bar */}
      <div className={cn("absolute top-0 left-0 right-0 h-px bg-gradient-to-r", a.topBar)} />

      {/* Top row: label + icon */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-none mt-1">{label}</p>
        {icon && (
          <div className={cn("p-2.5 rounded-xl", a.iconBg, a.iconText)}>
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="space-y-1">
        <p className={cn("font-bold leading-none", featured ? "text-3xl" : "text-2xl", a.valueCls)}>
          {value}
        </p>
        {subValue && (
          <p className="text-sm text-gray-500 mt-1.5">{subValue}</p>
        )}
      </div>

      {/* Change badge */}
      {change !== undefined && (
        <div className="mt-4 flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-full",
            isPositive ? a.badgePos : a.badgeNeg,
          )}>
            {isPositive ? (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-xs text-gray-600">vs last month</span>
        </div>
      )}
    </div>
  );
}
