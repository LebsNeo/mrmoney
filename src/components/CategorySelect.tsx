"use client";

import { useRouter } from "next/navigation";

interface CategorySelectProps {
  options: string[];
  current?: string;
  basePath: string;
  currentType?: string;
}

export function CategorySelect({ options, current, basePath, currentType }: CategorySelectProps) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const q = new URLSearchParams();
    if (currentType) q.set("type", currentType);
    if (e.target.value) q.set("category", e.target.value);
    q.set("page", "1");
    router.push(`${basePath}?${q.toString()}`);
  }

  return (
    <select
      className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-500"
      defaultValue={current ?? ""}
      onChange={handleChange}
    >
      <option value="">All Categories</option>
      {options.map((c) => (
        <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
      ))}
    </select>
  );
}
