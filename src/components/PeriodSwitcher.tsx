"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PeriodPreset } from "@/lib/reports-utils";
import { Suspense } from "react";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "this_month",    label: "This Month"    },
  { value: "last_month",    label: "Last Month"    },
  { value: "this_quarter",  label: "This Quarter"  },
  { value: "last_quarter",  label: "Last Quarter"  },
  { value: "this_year",     label: "This Year"     },
  { value: "last_year",     label: "Last Year"     },
];

function PeriodSwitcherInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = (params.get("period") ?? "this_month") as PeriodPreset;
  const isCustom = current === "custom";

  function go(period: string, extra?: Record<string, string>) {
    const q = new URLSearchParams(params.toString());
    q.set("period", period);
    if (extra) Object.entries(extra).forEach(([k, v]) => q.set(k, v));
    if (period !== "custom") { q.delete("from"); q.delete("to"); }
    router.push(`${pathname}?${q.toString()}`);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => go(p.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              current === p.value
                ? "bg-emerald-500 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => go("custom")}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
            isCustom
              ? "bg-emerald-500 text-white"
              : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
          }`}
        >
          Custom
        </button>
      </div>

      {isCustom && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            defaultValue={params.get("from") ?? ""}
            onChange={e => go("custom", { from: e.target.value, to: params.get("to") ?? "" })}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-gray-500 text-xs">to</span>
          <input
            type="date"
            defaultValue={params.get("to") ?? ""}
            onChange={e => go("custom", { from: params.get("from") ?? "", to: e.target.value })}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}
    </div>
  );
}

export function PeriodSwitcher() {
  return (
    <Suspense fallback={null}>
      <PeriodSwitcherInner />
    </Suspense>
  );
}
