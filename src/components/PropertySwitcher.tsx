"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface Property {
  id: string;
  name: string;
}

interface PropertySwitcherProps {
  properties: Property[];
  currentPropertyId?: string | null;
}

export function PropertySwitcher({ properties, currentPropertyId }: PropertySwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentProperty = properties.find((p) => p.id === currentPropertyId);
  const label = currentProperty?.name ?? "All Properties";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function select(propertyId: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (propertyId) {
      params.set("propertyId", propertyId);
    } else {
      params.delete("propertyId");
    }
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  if (properties.length < 2) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border transition-all",
          currentProperty
            ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:shadow-[0_0_18px_rgba(16,185,129,0.4)] hover:border-emerald-400/70"
            : "bg-gray-800 border-gray-700 text-gray-300 hover:text-white hover:border-gray-600"
        )}
      >
        <svg className={cn("w-4 h-4", currentProperty ? "text-emerald-400" : "text-gray-500")} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
        <span className="max-w-[120px] truncate">{label}</span>
        <svg className={cn("w-3.5 h-3.5 transition-transform", currentProperty ? "text-emerald-400" : "text-gray-500", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[180px]">
          <button
            onClick={() => select(null)}
            className={cn(
              "w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2",
              !currentPropertyId
                ? "text-emerald-400 bg-emerald-500/10"
                : "text-gray-300 hover:text-white hover:bg-gray-800"
            )}
          >
            {!currentPropertyId && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
            <span className={!currentPropertyId ? "" : "pl-3.5"}>All Properties</span>
          </button>
          {properties.map((p) => (
            <button
              key={p.id}
              onClick={() => select(p.id)}
              className={cn(
                "w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2",
                currentPropertyId === p.id
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-gray-300 hover:text-white hover:bg-gray-800"
              )}
            >
              {currentPropertyId === p.id && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
              <span className={currentPropertyId === p.id ? "" : "pl-3.5"}>{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
