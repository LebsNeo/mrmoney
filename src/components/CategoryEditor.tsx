"use client";

import { useState, useTransition } from "react";
import { TransactionCategory } from "@prisma/client";
import { updateTransactionCategory } from "@/lib/actions/transactions";

const ALL_CATEGORIES: TransactionCategory[] = [
  "ACCOMMODATION", "FB", "LAUNDRY",
  "CLEANING", "SUPPLIES", "OTA_COMMISSION",
  "MAINTENANCE", "UTILITIES", "SALARIES", "MARKETING",
  "LOAN_INTEREST", "BANK_CHARGES",
  "VAT_OUTPUT", "VAT_INPUT", "OTHER",
];

interface CategoryEditorProps {
  txId: string;
  category: TransactionCategory;
}

export function CategoryEditor({ txId, category }: CategoryEditorProps) {
  const [current, setCurrent] = useState<TransactionCategory>(category);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as TransactionCategory;
    setCurrent(next);
    setStatus("saving");

    startTransition(async () => {
      try {
        await updateTransactionCategory(txId, next);
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 1500);
      } catch {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2000);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={current}
        onChange={handleChange}
        disabled={isPending}
        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-0.5 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 cursor-pointer hover:border-gray-600 transition-colors"
      >
        {ALL_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {status === "saving" && (
        <span className="text-[10px] text-gray-500">saving…</span>
      )}
      {status === "saved" && (
        <span className="text-[10px] text-emerald-400">✓</span>
      )}
      {status === "error" && (
        <span className="text-[10px] text-red-400">failed</span>
      )}
    </div>
  );
}
