"use client";

import { useState } from "react";

type OTAPlatform = "BOOKING_COM" | "AIRBNB" | "LEKKERSLAAP" | "EXPEDIA" | "OTHER";
type OTAPayoutModel = "PER_BOOKING" | "BATCHED" | "DIRECT_PAY";

interface Config {
  id: string;
  propertyId: string;
  platform: OTAPlatform;
  payoutModel: OTAPayoutModel;
  commissionRate: number;
  serviceFeeRate: number;
  payoutDelayDays: number;
  bankDescriptionHint: string | null;
  isActive: boolean;
  property: { id: string; name: string };
}

interface Property { id: string; name: string }

interface Props {
  configs: Config[];
  properties: Property[];
}

const PLATFORM_META: Record<OTAPlatform, { label: string; color: string; defaultCommission: number; defaultServiceFee: number; defaultDelay: number; defaultHint: string; payoutModel: OTAPayoutModel }> = {
  BOOKING_COM:  { label: "Booking.com",  color: "#3b82f6", defaultCommission: 15,   defaultServiceFee: 2.1,  defaultDelay: 14, defaultHint: "BOOKING.COM BV",  payoutModel: "BATCHED" },
  AIRBNB:       { label: "Airbnb",       color: "#f43f5e", defaultCommission: 3.45, defaultServiceFee: 0,    defaultDelay: 14, defaultHint: "AIRBNB",          payoutModel: "PER_BOOKING" },
  LEKKERSLAAP:  { label: "Lekkerslaap",  color: "#f59e0b", defaultCommission: 15,   defaultServiceFee: 2,    defaultDelay: 21, defaultHint: "LEKKESLAAP",      payoutModel: "BATCHED" },
  EXPEDIA:      { label: "Expedia",      color: "#8b5cf6", defaultCommission: 15,   defaultServiceFee: 0,    defaultDelay: 30, defaultHint: "EXPEDIA",         payoutModel: "BATCHED" },
  OTHER:        { label: "Other",        color: "#6b7280", defaultCommission: 10,   defaultServiceFee: 0,    defaultDelay: 14, defaultHint: "",                payoutModel: "BATCHED" },
};

const PAYOUT_MODEL_LABELS: Record<OTAPayoutModel, string> = {
  PER_BOOKING: "Per booking (e.g. Airbnb)",
  BATCHED:     "Batched payout (e.g. Booking.com, Lekkerslaap)",
  DIRECT_PAY:  "Direct pay + commission invoice",
};

const PLATFORMS = Object.keys(PLATFORM_META) as OTAPlatform[];

const EMPTY_FORM = {
  propertyId: "",
  platform: "BOOKING_COM" as OTAPlatform,
  payoutModel: "BATCHED" as OTAPayoutModel,
  commissionRate: 15,
  serviceFeeRate: 0,
  payoutDelayDays: 14,
  bankDescriptionHint: "",
};

export function OTAChannelsClient({ configs: initial, properties }: Props) {
  const [configs, setConfigs] = useState<Config[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handlePlatformChange(platform: OTAPlatform) {
    const meta = PLATFORM_META[platform];
    setForm((f) => ({
      ...f,
      platform,
      payoutModel: meta.payoutModel,
      commissionRate: meta.defaultCommission,
      serviceFeeRate: meta.defaultServiceFee,
      payoutDelayDays: meta.defaultDelay,
      bankDescriptionHint: meta.defaultHint,
    }));
  }

  function openAdd() {
    const meta = PLATFORM_META["BOOKING_COM"];
    setForm({
      ...EMPTY_FORM,
      propertyId: properties[0]?.id ?? "",
      payoutModel: meta.payoutModel,
      commissionRate: meta.defaultCommission,
      serviceFeeRate: meta.defaultServiceFee,
      payoutDelayDays: meta.defaultDelay,
      bankDescriptionHint: meta.defaultHint,
    });
    setEditingId(null);
    setShowForm(true);
    setError("");
  }

  function openEdit(c: Config) {
    setForm({
      propertyId: c.propertyId,
      platform: c.platform,
      payoutModel: c.payoutModel,
      commissionRate: c.commissionRate * 100,
      serviceFeeRate: c.serviceFeeRate * 100,
      payoutDelayDays: c.payoutDelayDays,
      bankDescriptionHint: c.bankDescriptionHint ?? "",
    });
    setEditingId(c.id);
    setShowForm(true);
    setError("");
  }

  async function handleSave() {
    if (!form.propertyId) { setError("Select a property"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/ota-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: form.propertyId,
          platform: form.platform,
          payoutModel: form.payoutModel,
          commissionRate: form.commissionRate / 100,
          serviceFeeRate: form.serviceFeeRate / 100,
          payoutDelayDays: form.payoutDelayDays,
          bankDescriptionHint: form.bankDescriptionHint,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }

      // Refresh configs
      const refreshRes = await fetch("/api/settings/ota-channels");
      const refreshData = await refreshRes.json();
      if (refreshData.ok) setConfigs(refreshData.data.configs);

      setShowForm(false);
      setEditingId(null);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch("/api/settings/ota-channels", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setConfigs((cs) => cs.filter((c) => c.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  // Group by property
  const byProperty = properties.map((p) => ({
    property: p,
    configs: configs.filter((c) => c.propertyId === p.id),
  }));

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex justify-end">
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Add channel config
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-2xl p-4 flex gap-3">
        <span className="text-blue-400 text-lg mt-0.5">ℹ️</span>
        <div>
          <p className="text-sm font-medium text-blue-300 mb-1">Why configure this?</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            These settings tell MrMoney how each OTA pays you — commission rate, payout batching model, and the bank description keyword used to match payouts to your bank transactions during reconciliation.
          </p>
        </div>
      </div>

      {/* Configs by property */}
      {byProperty.map(({ property, configs: pConfigs }) => (
        <div key={property.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">🏠</span>
              <h3 className="text-sm font-semibold text-white">{property.name}</h3>
              <span className="text-xs text-gray-500">{pConfigs.length} channel{pConfigs.length !== 1 ? "s" : ""} configured</span>
            </div>
            {/* Show which platforms are missing */}
            <div className="flex items-center gap-1.5">
              {(["BOOKING_COM", "AIRBNB", "LEKKERSLAAP"] as OTAPlatform[]).map((pl) => {
                const configured = pConfigs.some((c) => c.platform === pl);
                const meta = PLATFORM_META[pl];
                return (
                  <span
                    key={pl}
                    style={{ color: configured ? meta.color : "#374151", borderColor: configured ? `${meta.color}40` : "#374151" }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded border"
                  >
                    {meta.label}
                  </span>
                );
              })}
            </div>
          </div>

          {pConfigs.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-gray-500 text-sm">No OTA channels configured for this property</p>
              <button
                onClick={openAdd}
                className="mt-3 text-emerald-400 text-sm hover:text-emerald-300 underline"
              >
                Add first channel →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {pConfigs.map((c) => {
                const meta = PLATFORM_META[c.platform];
                return (
                  <div key={c.id} className="px-6 py-4 flex items-center gap-4">
                    {/* Platform badge */}
                    <div
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}
                    >
                      {meta.label}
                    </div>

                    {/* Stats */}
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Commission</p>
                        <p className="text-sm font-semibold text-white">{(c.commissionRate * 100).toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Service fee</p>
                        <p className="text-sm font-semibold text-white">{(c.serviceFeeRate * 100).toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Payout delay</p>
                        <p className="text-sm font-semibold text-white">{c.payoutDelayDays}d</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Bank keyword</p>
                        <p className="text-sm font-semibold text-white font-mono">{c.bankDescriptionHint ?? "—"}</p>
                      </div>
                    </div>

                    {/* Payout model */}
                    <div className="hidden sm:block shrink-0">
                      <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-1 rounded">
                        {c.payoutModel === "PER_BOOKING" ? "Per booking" : c.payoutModel === "BATCHED" ? "Batched" : "Direct pay"}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(c)}
                        className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors disabled:opacity-50"
                      >
                        {deletingId === c.id ? "..." : "Remove"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {configs.length === 0 && properties.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <p className="text-3xl mb-3">🏨</p>
          <p className="text-white font-medium mb-2">No properties found</p>
          <p className="text-gray-500 text-sm">Add a property first, then configure your OTA channels.</p>
        </div>
      )}

      {/* ── FORM MODAL ─────────────────────────────────────────────────────── */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
        >
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h2 className="text-base font-semibold text-white">
                {editingId ? "Edit channel config" : "Add OTA channel config"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Property */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Property</label>
                <select
                  value={form.propertyId}
                  onChange={(e) => setField("propertyId", e.target.value)}
                  disabled={!!editingId}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="">Select property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Platform */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">OTA Platform</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map((pl) => {
                    const meta = PLATFORM_META[pl];
                    return (
                      <button
                        key={pl}
                        type="button"
                        disabled={!!editingId}
                        onClick={() => handlePlatformChange(pl)}
                        className="py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all disabled:opacity-50"
                        style={{
                          borderColor: form.platform === pl ? meta.color : "#374151",
                          background: form.platform === pl ? `${meta.color}15` : "transparent",
                          color: form.platform === pl ? meta.color : "#6b7280",
                        }}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payout model */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Payout model</label>
                <select
                  value={form.payoutModel}
                  onChange={(e) => setField("payoutModel", e.target.value as OTAPayoutModel)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  {(Object.entries(PAYOUT_MODEL_LABELS) as [OTAPayoutModel, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {/* Rates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Commission rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.commissionRate}
                    onChange={(e) => setField("commissionRate", parseFloat(e.target.value) || 0)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">e.g. 15 = 15%</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Service / handling fee (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.serviceFeeRate}
                    onChange={(e) => setField("serviceFeeRate", parseFloat(e.target.value) || 0)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">e.g. 2.1 for Lekkerslaap handling</p>
                </div>
              </div>

              {/* Payout delay */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Payout delay (days)</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={form.payoutDelayDays}
                  onChange={(e) => setField("payoutDelayDays", parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-gray-600 mt-1">Days after checkout before payout arrives</p>
              </div>

              {/* Bank hint */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Bank description keyword</label>
                <input
                  type="text"
                  value={form.bankDescriptionHint}
                  onChange={(e) => setField("bankDescriptionHint", e.target.value)}
                  placeholder="e.g. BOOKING.COM BV, AIRBNB, LEKKESLAAP"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-gray-600 mt-1">Used to match bank transactions during reconciliation</p>
              </div>

              {/* Effective rate summary */}
              {form.commissionRate > 0 && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                  <p className="text-xs font-medium text-gray-400 mb-2">Effective cost summary</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Commission</span>
                    <span className="text-white font-medium">{form.commissionRate.toFixed(2)}%</span>
                  </div>
                  {form.serviceFeeRate > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-400">Service fee</span>
                      <span className="text-white font-medium">{form.serviceFeeRate.toFixed(2)}%</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm mt-2 pt-2 border-t border-gray-700">
                    <span className="text-gray-300 font-medium">Total OTA cost</span>
                    <span className="text-emerald-400 font-bold">{(form.commissionRate + form.serviceFeeRate).toFixed(2)}%</span>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 py-5 border-t border-gray-800">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-700 text-sm font-medium text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : editingId ? "Save changes" : "Add config"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
