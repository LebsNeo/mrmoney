"use client";

import { useState, useRef } from "react";
import { updatePropertyBillingProfile } from "@/lib/actions/properties";

interface Props {
  propertyId: string;
  initial: {
    phone: string | null;
    email: string | null;
    taxNumber: string | null;
    logoUrl: string | null;
    website: string | null;
    bankName: string | null;
    bankAccount: string | null;
    bankBranch: string | null;
    invoiceFooter: string | null;
  };
}

export function PropertyBillingForm({ propertyId, initial }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    phone: initial.phone ?? "",
    email: initial.email ?? "",
    taxNumber: initial.taxNumber ?? "",
    logoUrl: initial.logoUrl ?? "",
    website: initial.website ?? "",
    bankName: initial.bankName ?? "",
    bankAccount: initial.bankAccount ?? "",
    bankBranch: initial.bankBranch ?? "",
    invoiceFooter: initial.invoiceFooter ?? "",
  });

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      showToast("Logo must be under 500KB", false);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      set("logoUrl", reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    setSaving(true);
    const res = await updatePropertyBillingProfile(propertyId, {
      phone: form.phone || undefined,
      email: form.email || undefined,
      taxNumber: form.taxNumber || undefined,
      logoUrl: form.logoUrl || undefined,
      website: form.website || undefined,
      bankName: form.bankName || undefined,
      bankAccount: form.bankAccount || undefined,
      bankBranch: form.bankBranch || undefined,
      invoiceFooter: form.invoiceFooter || undefined,
    });
    setSaving(false);
    showToast(res.message, res.success);
  }

  const hasProfile = !!(initial.phone || initial.email || initial.taxNumber || initial.bankName);

  return (
    <div className="mt-4 border-t border-gray-800 pt-4">
      {toast && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs font-medium ${toast.ok ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
          {toast.ok ? "✅" : "❌"} {toast.msg}
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
      >
        <span>{open ? "▼" : "▶"}</span>
        <span className="font-medium">Invoice Billing Profile</span>
        {!hasProfile && (
          <span className="text-amber-400 text-[10px] bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
            Incomplete
          </span>
        )}
        {hasProfile && (
          <span className="text-emerald-400 text-[10px] bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded">
            ✓ Set
          </span>
        )}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {/* Logo */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Property Logo</label>
            {form.logoUrl && (
              <div className="mb-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.logoUrl} alt="Logo preview" className="max-h-14 max-w-[140px] object-contain rounded border border-gray-700 bg-white p-1" />
                <button onClick={() => set("logoUrl", "")} className="text-xs text-red-400 hover:text-red-300">Remove</button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleLogoUpload}
              className="text-xs text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20 file:cursor-pointer"
            />
            <p className="text-[10px] text-gray-600 mt-1">PNG, JPG or SVG · max 500KB</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Phone" value={form.phone} onChange={v => set("phone", v)} placeholder="+27 13 123 4567" />
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Reply-To Email
                <span className="text-gray-600 ml-1">(client replies go here)</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="nelsbnb@gmail.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-gray-600 mt-1">Shown on invoice. When clients reply to the email, it lands here.</p>
            </div>
            <Field label="Website" value={form.website} onChange={v => set("website", v)} placeholder="www.golfbnb.co.za" />
            <Field label="VAT / Tax Number" value={form.taxNumber} onChange={v => set("taxNumber", v)} placeholder="4123456789" />
          </div>

          <div>
            <p className="text-xs text-gray-500 font-medium mb-2">Bank Details <span className="text-gray-600">(shown on invoice for payment)</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Bank Name" value={form.bankName} onChange={v => set("bankName", v)} placeholder="FNB / ABSA / Capitec..." />
              <Field label="Account Number" value={form.bankAccount} onChange={v => set("bankAccount", v)} placeholder="62xxxxxxxxx" />
              <Field label="Branch Code" value={form.bankBranch} onChange={v => set("bankBranch", v)} placeholder="250655" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Invoice Footer Message</label>
            <textarea
              value={form.invoiceFooter}
              onChange={e => set("invoiceFooter", e.target.value)}
              rows={2}
              placeholder="Thank you for staying with us. We hope to welcome you again soon!"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <p className="text-[10px] text-gray-600 mt-1">Printed at the bottom of every invoice. Leave blank to use the default message.</p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Billing Profile"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text"
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </div>
  );
}
