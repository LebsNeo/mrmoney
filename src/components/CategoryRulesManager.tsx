"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TransactionCategory } from "@prisma/client";
import {
  getCategorisationRules,
  upsertCategorisationRule,
  deleteCategorisationRule,
  applyRuleToExistingTransactions,
  type CatRule,
} from "@/lib/actions/categorisation-rules";

const CATEGORIES: { value: TransactionCategory; label: string; group: string }[] = [
  { value: "ACCOMMODATION", label: "Accommodation", group: "Revenue" },
  { value: "FB", label: "Food & Beverage", group: "Revenue" },
  { value: "LAUNDRY", label: "Laundry", group: "Revenue" },
  { value: "CLEANING", label: "Cleaning", group: "Cost of Sales" },
  { value: "SUPPLIES", label: "Supplies", group: "Cost of Sales" },
  { value: "OTA_COMMISSION", label: "OTA Commission", group: "Cost of Sales" },
  { value: "MAINTENANCE", label: "Maintenance", group: "Operating" },
  { value: "UTILITIES", label: "Utilities", group: "Operating" },
  { value: "SALARIES", label: "Salaries", group: "Operating" },
  { value: "MARKETING", label: "Marketing", group: "Operating" },
  { value: "BANK_CHARGES", label: "Bank Charges", group: "Financial" },
  { value: "LOAN_INTEREST", label: "Loan Interest", group: "Financial" },
  { value: "EMPLOYEE_ADVANCE", label: "Employee Advance", group: "Payroll" },
  { value: "VAT_OUTPUT", label: "VAT Output", group: "Tax" },
  { value: "VAT_INPUT", label: "VAT Input", group: "Tax" },
  { value: "OTHER", label: "Other", group: "Other" },
];

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  manual: { label: "Manual rule", color: "text-emerald-400 bg-emerald-500/10" },
  user_correction: { label: "Learned", color: "text-blue-400 bg-blue-500/10" },
  llm: { label: "AI rule", color: "text-purple-400 bg-purple-500/10" },
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CategoryRulesManager({ open, onClose }: Props) {
  const router = useRouter();
  const [rules, setRules] = useState<CatRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // New rule form
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<TransactionCategory>("ACCOMMODATION");
  const [applyExisting, setApplyExisting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getCategorisationRules().then((r) => {
      setRules(r);
      setLoading(false);
    });
  }, [open]);

  async function handleSave() {
    if (!keyword.trim()) return;
    setSaving(true);
    setSaveMsg(null);

    const res = await upsertCategorisationRule(keyword.trim(), category);
    if (!res.ok) {
      setSaveMsg({ ok: false, text: res.error ?? "Failed to save" });
      setSaving(false);
      return;
    }

    let appliedCount = 0;
    if (applyExisting) {
      const applyRes = await applyRuleToExistingTransactions(keyword.trim(), category);
      appliedCount = applyRes.updated ?? 0;
    }

    setSaveMsg({
      ok: true,
      text: applyExisting
        ? `Rule saved! Applied to ${appliedCount} existing transaction${appliedCount !== 1 ? "s" : ""}.`
        : "Rule saved! Will apply to future imports.",
    });
    setKeyword("");
    setApplyExisting(true);

    // Refresh rules list
    const updated = await getCategorisationRules();
    setRules(updated);
    setSaving(false);
    router.refresh();
  }

  function handleDelete(id: string, kw: string) {
    if (!window.confirm(`Delete rule for "${kw}"?`)) return;
    startTransition(async () => {
      await deleteCategorisationRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    });
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-gray-950 border-l border-gray-800 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-white font-semibold text-base">Categorisation Rules</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Keywords that auto-assign categories on import
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Add new rule */}
        <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Add New Rule
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Keyword <span className="text-gray-600">(appears in transaction description)</span>
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder="e.g. Truck guy Wandile, Siluluanzi, Eskom..."
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {Object.entries(
                  CATEGORIES.reduce((acc, c) => {
                    if (!acc[c.group]) acc[c.group] = [];
                    acc[c.group].push(c);
                    return acc;
                  }, {} as Record<string, typeof CATEGORIES>)
                ).map(([group, cats]) => (
                  <optgroup key={group} label={group}>
                    {cats.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={applyExisting}
                onChange={(e) => setApplyExisting(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs text-gray-400">
                Also apply to existing transactions in the database
              </span>
            </label>

            {saveMsg && (
              <p className={`text-xs ${saveMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
                {saveMsg.ok ? "✓ " : "✗ "}{saveMsg.text}
              </p>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !keyword.trim()}
              className="w-full px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save Rule"}
            </button>
          </div>
        </div>

        {/* Existing rules */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Your Rules {rules.length > 0 && <span className="text-gray-600">({rules.length})</span>}
          </p>

          {loading && (
            <p className="text-xs text-gray-600 text-center py-8">Loading rules...</p>
          )}

          {!loading && rules.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600 text-sm">No rules yet.</p>
              <p className="text-gray-700 text-xs mt-1">
                Rules are created automatically when you fix a category, or you can add them manually above.
              </p>
            </div>
          )}

          {!loading && rules.length > 0 && (
            <div className="space-y-2">
              {rules.map((rule) => {
                const src = SOURCE_LABELS[rule.source] ?? SOURCE_LABELS.manual;
                const catLabel = CATEGORIES.find((c) => c.value === rule.category)?.label ?? rule.category;
                return (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-white font-mono truncate">
                          "{rule.keyword}"
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${src.color}`}>
                          {src.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">→</span>
                        <span className="text-xs text-emerald-400 font-medium">{catLabel}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(rule.id, rule.keyword)}
                      disabled={isPending}
                      className="ml-3 text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-sm"
                      title="Delete rule"
                    >
                      🗑
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-700">
            💡 Rules are checked before AI — the more rules you add, the smarter and faster future imports become.
          </p>
        </div>
      </div>
    </>
  );
}
