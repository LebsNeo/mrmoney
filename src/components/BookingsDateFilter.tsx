"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type DateField = "checkIn" | "checkOut";

export function BookingsDateFilter({
  dateFrom,
  dateTo,
  dateField = "checkIn",
}: {
  dateFrom?: string;
  dateTo?: string;
  dateField?: DateField;
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

  const setDateField = useCallback(
    (field: DateField) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("dateField", field);
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const clearDates = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("dateFrom");
    params.delete("dateTo");
    params.delete("dateField");
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const hasFilter = dateFrom || dateTo;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Field toggle */}
      <div className="flex rounded-lg overflow-hidden border border-gray-700 text-xs">
        <button
          onClick={() => setDateField("checkIn")}
          className={`px-2.5 py-1 font-medium transition-colors ${
            dateField === "checkIn"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          Check-in
        </button>
        <button
          onClick={() => setDateField("checkOut")}
          className={`px-2.5 py-1 font-medium transition-colors border-l border-gray-700 ${
            dateField === "checkOut"
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-gray-800 text-gray-400 hover:text-white"
          }`}
        >
          Check-out
        </button>
      </div>

      {/* Date range inputs */}
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
