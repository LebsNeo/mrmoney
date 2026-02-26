"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/LoadingButton";

type Platform = "BOOKING_COM" | "LEKKERSLAAP" | "AIRBNB";
type FileType = "csv" | "pdf";

const PLATFORM_CONFIG: Record<
  Platform,
  {
    label: string;
    fileType: FileType;
    accept: string;
    commissionRate: string;
    instructions: string[];
    warning?: string;
    color: string;
  }
> = {
  BOOKING_COM: {
    label: "Booking.com",
    fileType: "csv",
    accept: ".csv",
    commissionRate: "8–15%",
    color: "bg-blue-600",
    instructions: [
      "Log in to your Booking.com Extranet",
      'Go to Finance → "Financial Overview"',
      'Click "Export" → Select date range → Download CSV',
      "Upload the downloaded CSV file below",
    ],
  },
  LEKKERSLAAP: {
    label: "Lekkerslaap",
    fileType: "csv",
    accept: ".csv",
    commissionRate: "~17% + handling",
    color: "bg-orange-600",
    instructions: [
      "Log in to your Lekkerslaap host dashboard",
      'Go to "Finance" or "Statements"',
      'Click "Download Statement" → CSV format',
      "Upload the downloaded CSV file below",
    ],
  },
  AIRBNB: {
    label: "Airbnb",
    fileType: "csv",
    accept: ".csv",
    commissionRate: "~3.45%",
    color: "bg-red-500",
    instructions: [
      "Log in to your Airbnb host account",
      'Go to "Menu" → "Earnings"',
      'Click "Completed payouts" or "Upcoming payouts"',
      'Click the download icon → "Download CSV"',
      "Upload the downloaded CSV file below",
    ],
  },
};

interface OTAImportFormProps {
  properties: { id: string; name: string }[];
  organisationId?: string;
}

export default function OTAImportForm({
  properties,
  organisationId = "",
}: OTAImportFormProps) {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>("BOOKING_COM");
  const [propertyId, setPropertyId] = useState(properties[0]?.id || "");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    details?: {
      payoutsCreated: number;
      itemsCreated: number;
      itemsMatched: number;
      warnings: string[];
    };
  } | null>(null);

  const config = PLATFORM_CONFIG[platform];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("platform", platform);
      formData.append("propertyId", propertyId);
      formData.append("organisationId", organisationId);

      const response = await fetch("/api/ota/import", {
        method: "POST",
        body: formData,
      });

      const json = await response.json();
      // apiSuccess wraps payload as { success: true, data: {...} }
      // apiError wraps as { success: false, error: "..." }
      const data = json.data ?? json;

      if (response.ok) {
        setResult({
          success: true,
          message: `Import successful!`,
          details: data,
        });
        setTimeout(() => router.push("/ota-payouts"), 2000);
      } else {
        setResult({
          success: false,
          message: json.error || data.error || "Import failed. Please try again.",
        });
      }
    } catch {
      setResult({
        success: false,
        message: "Network error. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Platform Selector */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">
          Select your OTA platform
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPlatform(p);
                setFile(null);
                setResult(null);
              }}
              className={`py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                platform === p
                  ? "border-teal-600 bg-teal-50 text-teal-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {PLATFORM_CONFIG[p].label}
              <span className="block text-xs font-normal mt-0.5 text-slate-400">
                {PLATFORM_CONFIG[p].fileType.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Property Selector */}
      {properties.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Which property is this payout for?
          </label>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <p className="text-sm font-semibold text-slate-700 mb-2">
          How to export from {config.label}
        </p>
        <ol className="space-y-1">
          {config.instructions.map((step, i) => (
            <li key={i} className="text-sm text-slate-600 flex gap-2">
              <span className="text-teal-600 font-semibold shrink-0">
                {i + 1}.
              </span>
              {step}
            </li>
          ))}
        </ol>
        {config.warning && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
            ⚠️ {config.warning}
          </div>
        )}
      </div>

      {/* File Upload */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Upload {config.label} {config.fileType.toUpperCase()} file
          </label>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              file
                ? "border-teal-400 bg-teal-50"
                : "border-slate-300 hover:border-teal-400 hover:bg-slate-50"
            }`}
            onClick={() =>
              document.getElementById("ota-file-input")?.click()
            }
          >
            <input
              id="ota-file-input"
              type="file"
              accept={config.accept}
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setResult(null);
              }}
            />
            {file ? (
              <div>
                <p className="text-teal-700 font-medium">✅ {file.name}</p>
                <p className="text-slate-500 text-sm mt-1">
                  {(file.size / 1024).toFixed(1)} KB — Click to change
                </p>
              </div>
            ) : (
              <div>
                <p className="text-slate-500 text-sm">
                  Click to select your {config.label}{" "}
                  {config.fileType.toUpperCase()} file
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  Accepts: {config.accept}
                </p>
              </div>
            )}
          </div>
        </div>

        <LoadingButton
          type="submit"
          loading={loading}
          loadingText={`Importing ${config.label} data...`}
          disabled={!file}
          className="w-full bg-teal-700 hover:bg-teal-800 text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Import {config.label} Payouts
        </LoadingButton>
      </form>

      {/* Result */}
      {result && (
        <div
          className={`p-4 rounded-lg border ${
            result.success
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <p className="font-medium">{result.message}</p>
          {result.details && (
            <ul className="mt-2 text-sm space-y-1">
              <li>✅ {result.details.payoutsCreated} payout batch(es) created</li>
              <li>📋 {result.details.itemsCreated} booking items imported</li>
              <li>🔗 {result.details.itemsMatched} matched to existing bookings</li>
              {(result.details.warnings ?? []).map((w, i) => (
                <li key={i} className="text-amber-700">⚠️ {w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
