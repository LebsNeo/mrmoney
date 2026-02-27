"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { TransactionCategory } from "@prisma/client";
import { createExpense } from "@/lib/actions/expenses";

const CATEGORIES: { value: TransactionCategory; label: string; emoji: string }[] = [
  { value: "ACCOMMODATION", label: "Accommodation", emoji: "🏠" },
  { value: "FB", label: "Food & Beverages", emoji: "🍽️" },
  { value: "CLEANING", label: "Cleaning", emoji: "🧹" },
  { value: "LAUNDRY", label: "Laundry", emoji: "👕" },
  { value: "MAINTENANCE", label: "Maintenance", emoji: "🔧" },
  { value: "UTILITIES", label: "Utilities", emoji: "💡" },
  { value: "SALARIES", label: "Salaries", emoji: "💰" },
  { value: "MARKETING", label: "Marketing", emoji: "📣" },
  { value: "SUPPLIES", label: "Supplies", emoji: "📦" },
  { value: "OTA_COMMISSION", label: "OTA Commission", emoji: "🌐" },
  { value: "OTHER", label: "Other", emoji: "📝" },
];

interface ScanResult {
  store?: string;
  date?: string;
  total?: number;
  subtotal?: number;
  vatAmount?: number;
  items?: { description: string; amount: number }[];
  category?: TransactionCategory;
  confidence?: string;
  notes?: string;
}

interface Property { id: string; name: string; }

interface Props {
  onClose: () => void;
  defaultMode?: "manual" | "scan";
}

export function ExpenseModal({ onClose, defaultMode = "manual" }: Props) {
  const [mode, setMode] = useState<"manual" | "scan">(defaultMode);
  const [step, setStep] = useState<"capture" | "review">("capture");
  const [properties, setProperties] = useState<Property[]>([]);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    propertyId: "",
    description: "",
    amount: "",
    category: "OTHER" as TransactionCategory,
    date: today,
    vatRate: "0",
    isVatInclusive: false,
    notes: "",
    reference: "",
  });

  // Fetch properties on mount
  useEffect(() => {
    fetch("/api/user/properties")
      .then(r => r.json())
      .then(d => {
        const list: Property[] = d.data ?? d;
        setProperties(list);
        if (list.length === 1) setForm(f => ({ ...f, propertyId: list[0].id }));
      })
      .catch(() => {});
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function set<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Image handling ────────────────────────────────────────────────

  async function handleImageSelect(file: File) {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setScanResult(null);
  }

  async function handleScan() {
    if (!imageFile) return;
    setScanning(true);

    try {
      // Scan + upload in parallel
      const scanForm = new FormData();
      scanForm.append("image", imageFile);

      const uploadForm = new FormData();
      uploadForm.append("image", imageFile);

      const [scanRes, uploadRes] = await Promise.all([
        fetch("/api/expenses/scan-receipt", { method: "POST", body: scanForm }),
        fetch("/api/expenses/upload-receipt", { method: "POST", body: uploadForm }),
      ]);

      const scanData = await scanRes.json();
      const uploadData = uploadRes.ok ? await uploadRes.json() : null;

      if (uploadData?.data?.url) setReceiptUrl(uploadData.data.url);

      const result: ScanResult = scanData.data ?? scanData;
      setScanResult(result);

      // Pre-fill form from AI result
      setForm(prev => ({
        ...prev,
        description: result.store || prev.description,
        amount: result.total ? String(result.total) : prev.amount,
        category: result.category && CATEGORIES.find(c => c.value === result.category)
          ? result.category
          : prev.category,
        date: result.date || prev.date,
        vatRate: result.vatAmount && result.subtotal
          ? String(Math.round((result.vatAmount / result.subtotal) * 100) / 100)
          : prev.vatRate,
        notes: result.items?.length
          ? result.items.map(i => `${i.description}: R${i.amount.toFixed(2)}`).join(" | ")
          : prev.notes,
      }));

      setStep("review");
    } catch {
      showToast("Scan failed — please fill in manually", false);
    } finally {
      setScanning(false);
    }
  }

  async function handleSave() {
    if (!form.description.trim()) { showToast("Description is required", false); return; }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) { showToast("Please enter a valid amount", false); return; }

    setSaving(true);
    const res = await createExpense({
      propertyId: form.propertyId || undefined,
      description: form.description,
      amount,
      category: form.category,
      date: form.date,
      vatRate: parseFloat(form.vatRate) || 0,
      isVatInclusive: form.isVatInclusive,
      notes: form.notes || undefined,
      receiptUrl: receiptUrl || undefined,
      reference: form.reference || undefined,
    });
    setSaving(false);

    if (res.success) {
      onClose();
    } else {
      showToast(res.message, false);
    }
  }

  const vatAmt = () => {
    const a = parseFloat(form.amount) || 0;
    const r = parseFloat(form.vatRate) || 0;
    if (!r) return 0;
    return form.isVatInclusive ? a - a / (1 + r) : a * r;
  };

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full sm:max-w-lg bg-gray-900 border border-gray-700 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-white">Record Expense</h2>
            {scanResult && (
              <p className={`text-xs mt-0.5 ${
                scanResult.confidence === "HIGH" ? "text-emerald-400" :
                scanResult.confidence === "MEDIUM" ? "text-amber-400" : "text-gray-400"
              }`}>
                {scanResult.confidence === "HIGH" ? "✅" : scanResult.confidence === "MEDIUM" ? "⚠️" : "🔍"}{" "}
                AI {scanResult.confidence?.toLowerCase()} confidence — review before saving
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-800 shrink-0">
          {[
            { key: "manual", label: "✏️ Manual Entry" },
            { key: "scan", label: "📸 Scan Receipt" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setMode(t.key as "manual" | "scan"); setStep("capture"); setScanResult(null); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                mode === t.key
                  ? "text-emerald-400 border-b-2 border-emerald-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {/* ── SCAN MODE ── */}
          {mode === "scan" && step === "capture" && (
            <div className="p-5 space-y-4">
              {/* Image drop / select area */}
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-700 hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition-colors group"
              >
                {imagePreview ? (
                  <div className="space-y-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Receipt preview" className="max-h-48 mx-auto rounded-xl object-contain" />
                    <p className="text-xs text-gray-400">Tap to change image</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-5xl">📷</div>
                    <p className="text-white font-medium">Take a photo or upload</p>
                    <p className="text-xs text-gray-500">Till slip, invoice or receipt</p>
                    <div className="flex gap-2 justify-center text-xs text-gray-500">
                      <span className="bg-gray-800 px-2 py-1 rounded-lg">JPG</span>
                      <span className="bg-gray-800 px-2 py-1 rounded-lg">PNG</span>
                      <span className="bg-gray-800 px-2 py-1 rounded-lg">HEIC</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Hidden input — capture=environment lets mobile use camera */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleImageSelect(f);
                }}
              />

              {/* Or upload from gallery (no capture attribute) */}
              {!imagePreview && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = ev => {
                      const f = (ev.target as HTMLInputElement).files?.[0];
                      if (f) handleImageSelect(f);
                    };
                    input.click();
                  }}
                  className="w-full py-2.5 rounded-xl text-sm bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-colors"
                >
                  📁 Choose from gallery
                </button>
              )}

              {imagePreview && (
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="w-full py-3 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {scanning ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Reading receipt...
                    </span>
                  ) : "✨ Scan & Auto-Fill"}
                </button>
              )}

              <div className="text-center">
                <button
                  onClick={() => { setMode("manual"); setStep("capture"); }}
                  className="text-xs text-gray-500 hover:text-gray-400 underline"
                >
                  Enter manually instead
                </button>
              </div>
            </div>
          )}

          {/* ── FORM (manual or scan review) ── */}
          {(mode === "manual" || (mode === "scan" && step === "review")) && (
            <div className="p-5 space-y-4">
              {/* Scan result banner */}
              {scanResult && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                  <p className="text-xs text-emerald-400 font-medium">
                    ✨ Receipt scanned from {scanResult.store || "unknown store"} — review and adjust below
                  </p>
                  {receiptUrl && <p className="text-[10px] text-gray-500 mt-1">📎 Receipt image saved</p>}
                </div>
              )}

              {/* Receipt thumbnail (scan mode) */}
              {imagePreview && mode === "scan" && (
                <div className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Receipt" className="w-12 h-12 object-cover rounded-lg" />
                  <div>
                    <p className="text-xs text-white font-medium">Receipt attached</p>
                    <p className="text-[10px] text-gray-400">Stored for tax records</p>
                  </div>
                  <button
                    onClick={() => { setStep("capture"); setScanResult(null); }}
                    className="ml-auto text-xs text-gray-500 hover:text-white"
                  >
                    Change
                  </button>
                </div>
              )}

              {/* Property selector */}
              {properties.length > 1 && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 font-medium">Property</label>
                  <select
                    value={form.propertyId}
                    onChange={e => set("propertyId", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">All Properties</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Description <span className="text-red-400">*</span></label>
                <input
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  placeholder="e.g. Checkers cleaning supplies"
                  autoFocus={mode === "manual"}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Amount + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 font-medium">Amount (R) <span className="text-red-400">*</span></label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={e => set("amount", e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5 font-medium">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => set("date", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => set("category", cat.value)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[11px] font-medium transition-all border ${
                        form.category === cat.value
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                          : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white"
                      }`}
                    >
                      <span className="text-xl">{cat.emoji}</span>
                      <span className="text-center leading-tight">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* VAT */}
              <div className="bg-gray-800/50 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 font-medium">VAT</span>
                  <select
                    value={form.vatRate}
                    onChange={e => set("vatRate", e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                  >
                    <option value="0">No VAT</option>
                    <option value="0.15">15% VAT</option>
                    <option value="0.09">9% VAT</option>
                  </select>
                </div>
                {parseFloat(form.vatRate) > 0 && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isVatInclusive}
                        onChange={e => set("isVatInclusive", e.target.checked)}
                        className="rounded"
                      />
                      VAT inclusive (extract from amount)
                    </label>
                    <span className="text-xs text-emerald-400 font-medium">
                      VAT: R{vatAmt().toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Reference + Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Reference / PO</label>
                  <input
                    value={form.reference}
                    onChange={e => set("reference", e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Notes</label>
                  <input
                    value={form.notes}
                    onChange={e => set("notes", e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className={`mx-5 mb-2 px-3 py-2 rounded-xl text-xs font-medium ${
            toast.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                     : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}>
            {toast.ok ? "✅" : "❌"} {toast.msg}
          </div>
        )}

        {/* Footer buttons */}
        {(mode === "manual" || (mode === "scan" && step === "review")) && (
          <div className="px-5 pb-5 pt-3 flex gap-3 border-t border-gray-800 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-2 flex-grow-[2] py-3 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "💾 Record Expense"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
