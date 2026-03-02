"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Props {
  dateFrom?: string;
  dateTo?: string;
}

export function DateRangeFilter({ dateFrom, dateTo }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
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
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-400 font-medium">Date:</label>
      <input
        type="date"
        value={dateFrom ?? ""}
        onChange={(e) => updateParam("dateFrom", e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]"
      />
      <span className="text-gray-600 text-xs">→</span>
      <input
        type="date"
        value={dateTo ?? ""}
        onChange={(e) => updateParam("dateTo", e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 [color-scheme:dark]"
      />
      {hasFilter && (
        <button
          onClick={clearDates}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors ml-1"
          title="Clear date filter"
        >
          ✕
        </button>
      )}
    </div>
  );
}
