"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface AlertBellProps {
  /** Optional static count — if omitted, fetches from /api/alerts/count */
  unreadCount?: number;
}

export function AlertBell({ unreadCount: staticCount }: AlertBellProps) {
  const [count, setCount] = useState(staticCount ?? 0);

  useEffect(() => {
    if (staticCount !== undefined) return; // use static value if provided
    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await fetch("/api/alerts/count");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch {
        // ignore fetch errors silently
      }
    }

    fetchCount();
    // Refresh every 60 seconds
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [staticCount]);

  return (
    <Link
      href="/automation"
      className="relative flex items-center justify-center w-9 h-9 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      title={`${count} unread alert${count !== 1 ? "s" : ""}`}
    >
      {/* Bell icon */}
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>

      {/* Badge */}
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
