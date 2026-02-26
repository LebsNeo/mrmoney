export function TransactionListSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-gray-800 rounded" />
          <div className="h-3 w-28 bg-gray-800 rounded" />
        </div>
      </div>

      {/* Filters skeleton */}
      <div className="flex gap-3 mb-6">
        <div className="h-7 w-16 bg-gray-800 rounded-lg" />
        <div className="h-7 w-20 bg-gray-800 rounded-lg" />
        <div className="h-7 w-20 bg-gray-800 rounded-lg" />
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="divide-y divide-gray-800">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-4 py-3 ${i % 2 === 0 ? "bg-gray-900" : "bg-gray-800/20"}`}
            >
              <div className="h-4 w-20 bg-gray-800 rounded" />
              <div className="h-4 w-48 bg-gray-800 rounded flex-1" />
              <div className="h-5 w-24 bg-gray-800 rounded-full" />
              <div className="h-5 w-16 bg-gray-800 rounded-full" />
              <div className="h-4 w-20 bg-gray-800 rounded ml-auto" />
              <div className="h-4 w-12 bg-gray-800 rounded" />
              <div className="h-5 w-16 bg-gray-800 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
