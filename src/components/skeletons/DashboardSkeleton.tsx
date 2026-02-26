import { KPICardSkeleton } from "./KPICardSkeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>

      {/* Section skeletons */}
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="h-4 w-40 bg-gray-800 rounded" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-3 bg-gray-800 rounded w-full" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
