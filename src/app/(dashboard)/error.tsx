"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[DashboardError]", error);
    }
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
        <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-7 h-7 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-white mb-2">
          Something went wrong
        </h2>

        <p className="text-slate-400 text-sm mb-6">
          {process.env.NODE_ENV === "development" && error?.message
            ? error.message
            : "This section encountered an error. You can reset it or return to the dashboard."}
        </p>

        {error?.digest && (
          <p className="text-slate-600 text-xs font-mono mb-5">
            Ref: {error.digest}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 px-4 rounded-lg transition-colors text-sm text-center"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
