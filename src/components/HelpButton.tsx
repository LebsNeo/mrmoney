"use client";

import Link from "next/link";

interface Props {
  article: string;
  label?: string;
}

export function HelpButton({ article, label }: Props) {
  return (
    <Link
      href={`/help?article=${article}`}
      className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-400 transition-colors"
      title="Help"
    >
      <span className="w-5 h-5 rounded-full border border-gray-700 hover:border-emerald-500/50 flex items-center justify-center text-xs font-bold transition-colors">
        ?
      </span>
      {label && <span>{label}</span>}
    </Link>
  );
}
