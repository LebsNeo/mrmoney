export default function ForecastLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-32 bg-gray-800 rounded" />
          <div className="h-3 w-56 bg-gray-800 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
            <div className="h-3 w-24 bg-gray-800 rounded" />
            <div className="h-7 w-32 bg-gray-800 rounded" />
            <div className="h-3 w-20 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="h-4 w-40 bg-gray-800 rounded" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-800 rounded w-full" />
        ))}
      </div>
    </div>
  );
}
