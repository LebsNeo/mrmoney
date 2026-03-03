"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CategoryEditor } from "@/components/CategoryEditor";
import { StatusBadge } from "@/components/StatusBadge";
import { CategoryRulesManager } from "@/components/CategoryRulesManager";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deleteTransaction, deleteTransactions } from "@/lib/actions/transactions";
import { TransactionType, TransactionCategory, TransactionStatus } from "@prisma/client";

interface Transaction {
  id: string;
  date: Date;
  description: string;
  amount: { toString(): string };
  vatAmount: { toString(): string };
  type: TransactionType;
  category: TransactionCategory;
  status: TransactionStatus;
  vendor?: { name: string } | null;
  property?: { name: string } | null;
}

interface Props {
  transactions: Transaction[];
}

export function TransactionsTable({ transactions }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [rulesOpen, setRulesOpen] = useState(false);

  const allSelected = transactions.length > 0 && selected.size === transactions.length;
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((t) => t.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDeleteOne(id: string) {
    if (!window.confirm("Delete this transaction? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteTransaction(id);
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      router.refresh();
    });
  }

  function handleDeleteSelected() {
    if (!window.confirm(`Delete ${selected.size} transaction${selected.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      await deleteTransactions(ids);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="relative">
      {/* Rules Manager */}
      <CategoryRulesManager open={rulesOpen} onClose={() => setRulesOpen(false)} />

      {/* Toolbar */}
      <div className="flex items-center justify-end mb-3">
        <button
          onClick={() => setRulesOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:border-emerald-500/50 transition-colors"
        >
          <span>⚙</span> Manage Rules
        </button>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="sticky top-0 z-20 mb-3 flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5">
          <span className="text-sm text-amber-400 font-medium">
            {selected.size} transaction{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-400 transition-colors disabled:opacity-50"
            >
              🗑 Delete {selected.size} selected
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900"
                  />
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Description</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">VAT</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className={`hover:bg-gray-800/50 transition-colors ${selected.has(tx.id) ? "bg-gray-800/70" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(tx.id)}
                      onChange={() => toggleOne(tx.id)}
                      className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{formatDate(tx.date)}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white">{tx.description}</p>
                      {tx.vendor && <p className="text-xs text-gray-500">{tx.vendor.name}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryEditor txId={tx.id} category={tx.category} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={tx.type.toLowerCase()} />
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${tx.type === "INCOME" ? "text-emerald-400" : "text-red-400"}`}>
                    {tx.type === "INCOME" ? "+" : "-"}{formatCurrency(tx.amount)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">
                    {formatCurrency(tx.vatAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={tx.status.toLowerCase()} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeleteOne(tx.id)}
                      disabled={isPending}
                      className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-30"
                      title="Delete transaction"
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
