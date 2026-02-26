"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OTAPlatform } from "@prisma/client";
import { importOTAPayoutCSV } from "@/lib/actions/ota-payouts";
import { useToast } from "@/context/ToastContext";

interface Property {
  id: string;
  name: string;
}

interface OTAImportFormProps {
  properties: Property[];
}

export function OTAImportForm({ properties }: OTAImportFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [platform, setPlatform] = useState<OTAPlatform>(OTAPlatform.AIRBNB);
  const [csvContent, setCsvContent] = useState("");
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; totalItems?: number; matchedItems?: number } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvContent(ev.target?.result as string);
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!propertyId) {
      setError("Please select a property");
      return;
    }
    if (!csvContent.trim()) {
      setError("Please upload a CSV file");
      return;
    }

    setLoading(true);
    try {
      const res = await importOTAPayoutCSV(propertyId, platform, csvContent, filename);
      setResult(res);

      if (res.success) {
        showToast(`Import successful! ${res.totalItems ?? 0} items imported, ${res.matchedItems ?? 0} matched`, "success");
        if (res.payoutId) {
          setTimeout(() => {
            router.push(`/ota-payouts/${res.payoutId}`);
          }, 2000);
        }
      } else {
        showToast(res.message, "error");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      showToast(msg, "error");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div
          className={`p-4 rounded-xl border text-sm ${
            result.success
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}
        >
          <p className="font-medium">{result.success ? "Import Successful!" : "Import Failed"}</p>
          <p className="mt-1 text-xs opacity-80">{result.message}</p>
          {result.success && (
            <p className="mt-1 text-xs opacity-80">
              {result.totalItems} items imported · {result.matchedItems} matched to bookings
            </p>
          )}
          {result.success && <p className="mt-1 text-xs">Redirecting to payout detail...</p>}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Import Settings
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Property *</label>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className={inputClass}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Platform *</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as OTAPlatform)}
              className={inputClass}
            >
              {Object.values(OTAPlatform).map((p) => (
                <option key={p} value={p}>
                  {p.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>CSV File *</label>
          <div className="relative">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="w-full bg-gray-800 border border-gray-700 border-dashed rounded-xl px-3 py-4 text-sm text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-500/20 file:text-emerald-400 file:text-xs file:font-medium hover:file:bg-emerald-500/30 cursor-pointer focus:outline-none"
            />
          </div>
          {filename && (
            <p className="text-xs text-emerald-400 mt-2">
              ✓ {filename} loaded ({csvContent.split("\n").length} rows)
            </p>
          )}
        </div>
      </div>

      {/* CSV format hints */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Supported CSV Formats
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-500">
          <div>
            <p className="text-gray-400 font-medium mb-1">Airbnb</p>
            <p>confirmation_code, guest, check-in, checkout, amount, host_fee, payout</p>
          </div>
          <div>
            <p className="text-gray-400 font-medium mb-1">Booking.com</p>
            <p>reservation_id, guest_name, arrival_date, departure_date, room_revenue, commission, net_revenue</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <a
          href="/ota-payouts"
          className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={loading || !csvContent}
          className="px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Importing..." : "Import Payout CSV"}
        </button>
      </div>
    </form>
  );
}
