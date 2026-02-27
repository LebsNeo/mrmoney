"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const PRESETS = [
  { label: "This Month",     key: "this_month" },
  { label: "Last Month",     key: "last_month" },
  { label: "This Quarter",   key: "this_quarter" },
  { label: "Last Quarter",   key: "last_quarter" },
  { label: "This Year",      key: "this_year" },
  { label: "Last Year",      key: "last_year" },
  { label: "Custom",         key: "custom" },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"];

function getPresetDates(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const lastDay = (year: number, month: number) =>
    new Date(year, month + 1, 0);

  switch (key) {
    case "this_month":
      return { from: fmt(new Date(y, m, 1)), to: fmt(lastDay(y, m)) };
    case "last_month":
      return { from: fmt(new Date(y, m - 1, 1)), to: fmt(lastDay(y, m - 1)) };
    case "this_quarter": {
      const q = Math.floor(m / 3);
      return { from: fmt(new Date(y, q * 3, 1)), to: fmt(lastDay(y, q * 3 + 2)) };
    }
    case "last_quarter": {
      const q = Math.floor(m / 3) - 1;
      const qy = q < 0 ? y - 1 : y;
      const qq = q < 0 ? 3 : q;
      return { from: fmt(new Date(qy, qq * 3, 1)), to: fmt(lastDay(qy, qq * 3 + 2)) };
    }
    case "this_year":
      return { from: fmt(new Date(y, 0, 1)), to: fmt(lastDay(y, 11)) };
    case "last_year":
      return { from: fmt(new Date(y - 1, 0, 1)), to: fmt(lastDay(y - 1, 11)) };
    default:
      return { from: fmt(new Date(y, m, 1)), to: fmt(lastDay(y, m)) };
  }
}

interface Props {
  propertyId?: string;
  properties: { id: string; name: string }[];
}

export function PLPeriodPicker({ propertyId, properties }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [preset, setPreset] = useState<PresetKey>((sp.get("preset") as PresetKey) ?? "this_month");
  const [customFrom, setCustomFrom] = useState(sp.get("from") ?? "");
  const [customTo, setCustomTo] = useState(sp.get("to") ?? "");
  const [propId, setPropId] = useState(propertyId ?? "");

  function apply(p: PresetKey, from?: string, to?: string, pid?: string) {
    const dates = p === "custom"
      ? { from: from ?? customFrom, to: to ?? customTo }
      : getPresetDates(p);
    if (!dates.from || !dates.to) return;
    const q = new URLSearchParams({
      from: dates.from,
      to: dates.to,
      preset: p,
      ...(pid ?? propId ? { propertyId: pid ?? propId } : {}),
    });
    router.push(`/reports/pl?${q.toString()}`);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => { setPreset(p.key); if (p.key !== "custom") apply(p.key); }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              preset === p.key
                ? "bg-emerald-500 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white border border-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-gray-500 text-sm">to</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={() => apply("custom")}
            disabled={!customFrom || !customTo}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}

      {properties.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Property:</span>
          <select
            value={propId}
            onChange={e => { setPropId(e.target.value); apply(preset, undefined, undefined, e.target.value); }}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            <option value="">All Properties</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
