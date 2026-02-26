export function KPICardSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-24 bg-gray-800 rounded" />
        <div className="h-4 w-4 bg-gray-800 rounded-full" />
      </div>
      <div className="h-7 w-32 bg-gray-800 rounded" />
      <div className="h-3 w-20 bg-gray-800 rounded" />
    </div>
  );
}
