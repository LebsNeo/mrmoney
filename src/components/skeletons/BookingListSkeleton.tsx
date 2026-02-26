export function BookingListSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-6 w-32 bg-gray-800 rounded" />
          <div className="h-3 w-24 bg-gray-800 rounded" />
        </div>
        <div className="h-9 w-28 bg-gray-800 rounded-xl" />
      </div>

      {/* Desktop table skeleton */}
      <div className="hidden md:block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="divide-y divide-gray-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 w-32 bg-gray-800 rounded" />
              <div className="h-4 w-20 bg-gray-800 rounded" />
              <div className="h-4 w-24 bg-gray-800 rounded" />
              <div className="h-4 w-24 bg-gray-800 rounded" />
              <div className="h-4 w-8 bg-gray-800 rounded ml-auto" />
              <div className="h-5 w-16 bg-gray-800 rounded-full" />
              <div className="h-5 w-16 bg-gray-800 rounded-full" />
              <div className="h-4 w-20 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile card skeletons */}
      <div className="md:hidden space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-32 bg-gray-800 rounded" />
              <div className="h-4 w-16 bg-gray-800 rounded" />
            </div>
            <div className="h-3 w-40 bg-gray-800 rounded" />
            <div className="flex gap-2">
              <div className="h-5 w-20 bg-gray-800 rounded-full" />
              <div className="h-5 w-16 bg-gray-800 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
