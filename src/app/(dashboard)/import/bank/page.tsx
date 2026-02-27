"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { importBankTransactions } from "@/lib/actions/automation";
import { TransactionCategory } from "@prisma/client";

const BANKS = ["FNB", "NEDBANK", "ABSA", "STANDARD_BANK", "CAPITEC", "QUICKBOOKS"] as const;

const CATEGORIES: TransactionCategory[] = [
  "ACCOMMODATION", "FB", "LAUNDRY", "CLEANING", "MAINTENANCE",
  "UTILITIES", "SALARIES", "MARKETING", "SUPPLIES", "OTA_COMMISSION",
  "VAT_OUTPUT", "VAT_INPUT", "OTHER",
];

interface PreviewRow {
  date: Date;
  description: string;
  amount: number;
  type: string;
  category: TransactionCategory;
  confidence: string;
  isDuplicate: boolean;
}

export default function BankImportPage() {
  const router = useRouter();
  const [bank, setBank] = useState<string>("CAPITEC");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [duplicates, setDuplicates] = useState<PreviewRow[]>([]);
  const [unrecognised, setUnrecognised] = useState<string[]>([]);
  const [categories, setCategories] = useState<Record<number, TransactionCategory>>({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ saved: number; duplicates: number; unrecognised: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
    setResult(null);
    setError(null);
    setCategories({});
    setLoading(true);

    try {
      const text = await f.text();

      // Call parse preview API
      const form = new FormData();
      form.append("bankFormat", bank);
      form.append("file", f);
      form.append("propertyId", "preview"); // Signal preview mode

      const resp = await fetch("/api/import/bank/preview", {
        method: "POST",
        body: form,
      });

      if (!resp.ok) {
        throw new Error("Preview failed");
      }

      const data = await resp.json();
      setPreview(data.transactions);
      setDuplicates(data.potentialDuplicates);
      setUnrecognised(data.unrecognised);
    } catch {
      setError("Failed to parse CSV. Please check the file format and bank selection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!file || !preview) return;
    setImporting(true);
    setError(null);

    try {
      const form = new FormData();
      form.append("bankFormat", bank);
      form.append("file", file);
      form.append("propertyId", "default"); // Will be resolved server-side from session
      form.append("categories", JSON.stringify(categories));

      const res = await importBankTransactions(form);
      setResult(res);
      setPreview(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Bank Statement Import"
        description="Import SA bank CSV statements and auto-categorise transactions"
      />

      {/* Bank selector + file upload */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Bank</label>
            <select
              value={bank}
              onChange={(e) => { setBank(e.target.value); setPreview(null); setFile(null); }}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {BANKS.map((b) => (
                <option key={b} value={b}>
                  {b === "QUICKBOOKS" ? "QuickBooks Export"
                   : b === "STANDARD_BANK" ? "Standard Bank"
                   : b.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">CSV File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20 file:cursor-pointer"
            />
          </div>
        </div>

        {/* Format hints */}
        <div className="bg-gray-800/50 rounded-xl p-3">
          <p className="text-xs text-gray-500 font-medium mb-1">Expected {bank.replace("_"," ")} CSV format:</p>
          <p className="text-xs text-gray-600 font-mono">
            {bank === "FNB" && "Date (DD MMM YYYY), Description, Amount, Balance"}
            {bank === "ABSA" && "Date (DD/MM/YYYY), Description, Debit, Credit, Balance"}
            {bank === "NEDBANK" && "Date (YYYY/MM/DD), Description, Debit, Credit, Balance"}
            {bank === "STANDARD_BANK" && "HIST rows: HIST, Date(YYYYMMDD), [##], Amount, Description, Reference"}
            {bank === "CAPITEC" && "Account, Date(DD/MM/YYYY), Description, Reference, Amount, Fees, Balance"}
            {bank === "QUICKBOOKS" && "Date, Transaction type, Number, Posting, Name, Memo, Account name, Account full name, Amount"}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {bank === "STANDARD_BANK" && "Export: Internet Banking → Account → View Statements → Export CSV"}
            {bank === "CAPITEC" && "Export: Capitec Business App → Accounts → Statement → Export CSV"}
            {bank === "QUICKBOOKS" && "Export: QB → Reports → Transaction List by Date → Export to CSV"}
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center mb-6">
          <p className="text-gray-400 text-sm">Parsing CSV...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base text-emerald-400 font-semibold">
                ✅ Import complete!
              </p>
              <p className="text-sm text-white mt-1">
                {result.saved} transaction{result.saved !== 1 ? "s" : ""} saved successfully
              </p>
              {result.duplicates > 0 && (
                <p className="text-xs text-amber-400 mt-1">⚠ {result.duplicates} potential duplicate{result.duplicates !== 1 ? "s" : ""} skipped</p>
              )}
              {result.unrecognised > 0 && (
                <p className="text-xs text-gray-500 mt-1">{result.unrecognised} unrecognised row{result.unrecognised !== 1 ? "s" : ""} skipped</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => { setResult(null); setFile(null); }}
                className="px-3 py-2 rounded-xl text-sm bg-gray-800 text-gray-300 hover:text-white border border-gray-700 transition-colors"
              >
                Import Another
              </button>
              <button
                onClick={() => router.push("/transactions")}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors"
              >
                View Transactions →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Table */}
      {preview && preview.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-6">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Preview — {preview.length} transaction{preview.length !== 1 ? "s" : ""}</h2>
              <p className="text-xs text-gray-500 mt-0.5">Edit categories below before importing</p>
            </div>
            {duplicates.length > 0 && (
              <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                ⚠ {duplicates.length} potential duplicate{duplicates.length !== 1 ? "s" : ""} detected
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Date</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Description</th>
                  <th className="text-right px-4 py-3 text-xs text-gray-500 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-500 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-800/50">
                    <td className="px-4 py-2.5 text-xs text-gray-400">
                      {new Date(row.date).toLocaleDateString("en-ZA")}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-white max-w-[200px] truncate">
                      {row.description}
                    </td>
                    <td className={`px-4 py-2.5 text-xs text-right font-medium ${row.type === "INCOME" ? "text-emerald-400" : "text-red-400"}`}>
                      {row.type === "INCOME" ? "+" : "-"}R{row.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{row.type}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={categories[i] ?? row.category}
                        onChange={(e) => setCategories((prev) => ({ ...prev, [i]: e.target.value as TransactionCategory }))}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        row.confidence === "HIGH"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : row.confidence === "MEDIUM"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-gray-700 text-gray-400"
                      }`}>
                        {row.confidence}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {unrecognised.length > 0 && `${unrecognised.length} unrecognised row${unrecognised.length !== 1 ? "s" : ""} will be skipped`}
            </p>
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? "Importing..." : `Import ${preview.length} transaction${preview.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}

      {preview && preview.length === 0 && !loading && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm">No new transactions found in this file (all may be duplicates).</p>
        </div>
      )}
    </div>
  );
}
