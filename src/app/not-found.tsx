import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg
            className="w-8 h-8 text-teal-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
        </div>

        <p className="text-teal-400 font-mono text-sm font-semibold mb-2">
          404
        </p>
        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-slate-400 text-sm mb-8">
          The page you&#39;re looking for doesn&#39;t exist or has been moved.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
            />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
