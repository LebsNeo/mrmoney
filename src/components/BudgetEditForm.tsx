"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertBudgetItem, copyBudgetFromPreviousMonth } from "@/lib/actions/budget";
import { TransactionCategory } from "@prisma/client";

interface BudgetItem {
  category: TransactionCategory;
  budgetedAmount: number;
}

interface Props {
  propertyId: string;
  period: string;
  previousPeriod: string;
  initialItems: BudgetItem[];
  allCategories: TransactionCategory[];
  availablePeriods: string[];
}

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

export function BudgetEditForm({
  propertyId,
  period,
  previousPeriod,
  initialItems,
  allCategories,
  availablePeriods,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const cat of allCategories) {
      const item = initialItems.find((i) => i.category === cat);
      map[cat] = item ? item.budgetedAmount.toFixed(2) : "";
    }
    return map;
  });
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleCopy = () => {
    startTransition(async () => {
      setCopyStatus("Copying...");
      const result = await copyBudgetFromPreviousMonth(
        propertyId,
        previousPeriod,
        selectedPeriod
      );
      setCopyStatus(`Copied ${result.copied} item(s) from ${formatPeriodLabel(previousPeriod)}`);
      router.refresh();
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      setSaveStatus("Saving...");
      const promises = allCategories
        .filter((cat) => amounts[cat] && parseFloat(amounts[cat]) > 0)
        .map((cat) =>
          upsertBudgetItem(propertyId, cat, selectedPeriod, parseFloat(amounts[cat]))
        );
      await Promise.all(promises);
      setSaveStatus("Saved successfully!");
      setTimeout(() => setSaveStatus(null), 3000);
    });
  };

  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriod(newPeriod);
    // Navigate to refresh data for new period
    router.push(`/budget/edit?period=${newPeriod}`);
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Period Selector */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5">Budget Month</label>
          <select
            value={selectedPeriod}
            onChange={(e) => handlePeriodChange(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {availablePeriods.map((p) => (
              <option key={p} value={p}>
                {formatPeriodLabel(p)}
              </option>
            ))}
          </select>
        </div>

        {/* Copy Button */}
        <div className="flex items-end gap-3">
          <button
            onClick={handleCopy}
            disabled={isPending}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Copy from {formatPeriodLabel(previousPeriod)}
          </button>
          {copyStatus && (
            <span className="text-xs text-gray-400">{copyStatus}</span>
          )}
        </div>
      </div>

      {/* Category Inputs */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">
            Budget Amounts — {formatPeriodLabel(selectedPeriod)}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Enter monthly budget amounts per category (leave blank to skip)
          </p>
        </div>
        <div className="divide-y divide-gray-800">
          {allCategories.map((cat) => (
            <div
              key={cat}
              className="px-6 py-3 flex items-center justify-between gap-4"
            >
              <label
                htmlFor={`budget-${cat}`}
                className="text-sm text-white font-medium min-w-[200px]"
              >
                {cat.replace(/_/g, " ")}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-sm">R</span>
                <input
                  id={`budget-${cat}`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amounts[cat] ?? ""}
                  onChange={(e) =>
                    setAmounts((prev) => ({ ...prev, [cat]: e.target.value }))
                  }
                  className="w-36 bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Budget"}
        </button>
        {saveStatus && (
          <span className={`text-sm ${saveStatus.includes("success") ? "text-emerald-400" : "text-gray-400"}`}>
            {saveStatus}
          </span>
        )}
      </div>
    </div>
  );
}
