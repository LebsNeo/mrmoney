"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PropertyType } from "@prisma/client";
import { createProperty, updatePropertyDetails } from "@/lib/actions/properties";

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "GUESTHOUSE", label: "Guesthouse" },
  { value: "HOTEL", label: "Hotel" },
  { value: "LODGE", label: "Lodge" },
  { value: "BOUTIQUE", label: "Boutique" },
  { value: "AIRBNB_PORTFOLIO", label: "Airbnb Portfolio" },
];

interface PropertyFormModalProps {
  mode: "create" | "edit";
  propertyId?: string;
  initial?: {
    name: string;
    type: PropertyType;
    address: string | null;
    city: string | null;
    country: string;
    isActive: boolean;
  };
  onClose: () => void;
}

export function PropertyFormModal({
  mode,
  propertyId,
  initial,
  onClose,
}: PropertyFormModalProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    type: initial?.type ?? ("GUESTHOUSE" as PropertyType),
    address: initial?.address ?? "",
    city: initial?.city ?? "",
    country: initial?.country ?? "ZA",
    isActive: initial?.isActive ?? true,
  });

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function set(field: keyof typeof form, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Property name is required"); return; }

    setSaving(true);
    setError(null);

    const res = mode === "create"
      ? await createProperty({
          name: form.name,
          type: form.type,
          address: form.address || undefined,
          city: form.city || undefined,
          country: form.country || "ZA",
        })
      : await updatePropertyDetails(propertyId!, {
          name: form.name,
          type: form.type,
          address: form.address || undefined,
          city: form.city || undefined,
          country: form.country || "ZA",
          isActive: form.isActive,
        });

    setSaving(false);

    if (!res.success) {
      setError(res.message);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">
            {mode === "create" ? "Add New Property" : "Edit Property"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">
              Property Name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="e.g. GolfBnB, NelsBNB, Sunset Lodge"
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Property Type</label>
            <select
              value={form.type}
              onChange={e => set("type", e.target.value as PropertyType)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {PROPERTY_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Address + City */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Street Address</label>
              <input
                value={form.address}
                onChange={e => set("address", e.target.value)}
                placeholder="3 Mandulia Street"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">City / Town</label>
              <input
                value={form.city}
                onChange={e => set("city", e.target.value)}
                placeholder="Mbombela"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Country */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Country Code</label>
            <input
              value={form.country}
              onChange={e => set("country", e.target.value.toUpperCase())}
              maxLength={2}
              placeholder="ZA"
              className="w-24 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase"
            />
            <p className="text-[10px] text-gray-600 mt-1">2-letter ISO code: ZA, ZW, BW, MZ…</p>
          </div>

          {/* Active toggle — edit mode only */}
          {mode === "edit" && (
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-white font-medium">Active</p>
                <p className="text-xs text-gray-500">Inactive properties are hidden from reports</p>
              </div>
              <button
                type="button"
                onClick={() => set("isActive", !form.isActive)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  form.isActive ? "bg-emerald-500" : "bg-gray-700"
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  form.isActive ? "translate-x-5" : "translate-x-0"
                }`} />
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving
                ? (mode === "create" ? "Creating..." : "Saving...")
                : (mode === "create" ? "Create Property" : "Save Changes")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
