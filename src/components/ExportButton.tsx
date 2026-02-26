"use client";

import { exportToCSV } from "@/lib/export";
import { cn } from "@/lib/utils";

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  label?: string;
  className?: string;
}

export function ExportButton({ data, filename, label = "Export CSV", className }: ExportButtonProps) {
  function handleExport() {
    exportToCSV(data, filename);
  }

  return (
    <button
      onClick={handleExport}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700 transition-colors",
        className
      )}
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      {label}
    </button>
  );
}
