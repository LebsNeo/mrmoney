import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  subValue?: string;
  change?: number; // percentage change, e.g. 12.5 = +12.5%
  icon?: React.ReactNode;
  className?: string;
}

export function KPICard({ label, value, subValue, change, icon, className }: KPICardProps) {
  const isPositive = change !== undefined && change >= 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className={cn(
      "bg-gray-900 border border-gray-800 rounded-2xl p-6",
      className
    )}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-gray-400">{label}</p>
        {icon && (
          <div className="p-2 rounded-lg bg-gray-800 text-gray-400">
            {icon}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-2xl font-bold text-white">{value}</p>
        {subValue && (
          <p className="text-sm text-gray-400">{subValue}</p>
        )}
      </div>

      {change !== undefined && (
        <div className="mt-4 flex items-center gap-1">
          <span className={cn(
            "flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full",
            isPositive && "bg-emerald-500/10 text-emerald-400",
            isNegative && "bg-red-500/10 text-red-400",
          )}>
            {isPositive && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {isNegative && (
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-xs text-gray-500">vs last month</span>
        </div>
      )}
    </div>
  );
}
