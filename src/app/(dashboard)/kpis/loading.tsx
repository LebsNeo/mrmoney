export default function KPIsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-gray-800 rounded" />
          <div className="h-3 w-64 bg-gray-800 rounded" />
        </div>
      </div>
      <div className="flex gap-2">
        {[3, 6, 12].map((m) => (
          <div key={m} className="h-8 w-12 bg-gray-800 rounded-lg" />
        ))}
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="h-4 w-48 bg-gray-800 rounded" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-800 rounded w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
