"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[AppError]", error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg
            className="w-8 h-8 text-red-400"
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

        <h1 className="text-xl font-semibold text-white mb-2">
          Something went wrong
        </h1>

        <p className="text-slate-400 text-sm mb-6">
          {process.env.NODE_ENV === "development" && error?.message
            ? error.message
            : "An unexpected error occurred. Please try again."}
        </p>

        {error?.digest && (
          <p className="text-slate-600 text-xs font-mono mb-6">
            Error ID: {error.digest}
          </p>
        )}

        <button
          onClick={reset}
          className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
