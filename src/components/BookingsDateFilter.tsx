"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function BookingsDateFilter({
  dateFrom,
  dateTo,
}: {
  dateFrom?: string;
  dateTo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const clearDates = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("dateFrom");
    params.delete("dateTo");
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const hasFilter = dateFrom || dateTo;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-xs text-gray-400 font-medium">Check-in:</label>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={dateFrom ?? ""}
          onChange={(e) => updateParam("dateFrom", e.target.value)}
          className="px-2.5 py-1 rounded-lg text-xs bg-gray-800 text-gray-300 border border-gray-700 focus:border-emerald-500 focus:outline-none"
        />
        <span className="text-gray-500 text-xs">→</span>
        <input
          type="date"
          value={dateTo ?? ""}
          onChange={(e) => updateParam("dateTo", e.target.value)}
          className="px-2.5 py-1 rounded-lg text-xs bg-gray-800 text-gray-300 border border-gray-700 focus:border-emerald-500 focus:outline-none"
        />
        {hasFilter && (
          <button
            onClick={clearDates}
            className="px-2 py-1 rounded-lg text-xs bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  );
}
