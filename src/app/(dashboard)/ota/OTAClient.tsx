"use client";

import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { OTAPlatform } from "@prisma/client";
import {
  upsertOTAChannelConfig,
  deleteOTAChannelConfig,
  seedDefaultOTAChannels,
} from "@/lib/actions/ota-channels";
import {
  previewOTAReconciliation,
  confirmOTAReconciliation,
  ReconcilePreviewItem,
} from "@/lib/actions/ota-reconcile";

interface Property { id: string; name: string }

interface ChannelConfig {
  id: string;
  propertyId: string;
  platform: OTAPlatform;
  payoutModel: string;
  commissionRate: number;
  serviceFeeRate: number;
  payoutDelayDays: number;
  bankDescriptionHint: string | null;
  isActive: boolean;
  property: { id: string; name: string };
}

const PLATFORMS: { value: OTAPlatform; label: string }[] = [
  { value: "BOOKING_COM", label: "Booking.com" },
  { value: "AIRBNB", label: "Airbnb" },
  { value: "LEKKERSLAAP", label: "Lekkerslaap" },
  { value: "EXPEDIA", label: "Expedia" },
  { value: "OTHER", label: "Other" },
];

const PAYOUT_MODELS = [
  { value: "PER_BOOKING", label: "Model A — Per Booking (Airbnb)" },
  { value: "BATCHED", label: "Model B — Batched Payout (Booking.com, Lekkerslaap)" },
  { value: "DIRECT_PAY", label: "Model C — Guest Pays Directly" },
];

const PLATFORM_LABELS: Record<string, string> = {
  BOOKING_COM: "Booking.com", AIRBNB: "Airbnb",
  LEKKERSLAAP: "Lekkerslaap", EXPEDIA: "Expedia", OTHER: "Other",
};

function platformBadgeColor(platform: string) {
  return platform === "BOOKING_COM" ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
    : platform === "AIRBNB" ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
    : platform === "LEKKERSLAAP" ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
    : "bg-gray-700/50 text-gray-400 border-gray-600";
}

export function OTAClient({ properties, configs: initialConfigs }: {
  properties: Property[];
  configs: ChannelConfig[];
}) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [tab, setTab] = useState<"channels" | "reconcile">("channels");

  // ── Channel Config modal state ─────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ChannelConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    propertyId: properties[0]?.id ?? "",
    platform: "BOOKING_COM" as OTAPlatform,
    payoutModel: "BATCHED",
    commissionRate: "15",
    serviceFeeRate: "2.1",
    payoutDelayDays: "7",
    bankDescriptionHint: "",
  });

  // ── Reconcile state ────────────────────────────────────────────────────────
  const [reconcilePropertyId, setReconcilePropertyId] = useState(properties[0]?.id ?? "");
  const [reconcilePlatform, setReconcilePlatform] = useState("BOOKING_COM");
  const [reconcileFile, setReconcileFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ReconcilePreviewItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewing, setPreviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{ saved: number } | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  // ── Channel Config handlers ────────────────────────────────────────────────

  function openAdd() {
    setEditing(null);
    setForm({
      propertyId: properties[0]?.id ?? "",
      platform: "BOOKING_COM",
      payoutModel: "BATCHED",
      commissionRate: "15",
      serviceFeeRate: "2.1",
      payoutDelayDays: "7",
      bankDescriptionHint: "BOOKING.COM BV",
    });
    setShowModal(true);
  }

  function openEdit(c: ChannelConfig) {
    setEditing(c);
    setForm({
      propertyId: c.propertyId,
      platform: c.platform,
      payoutModel: c.payoutModel,
      commissionRate: String(+(c.commissionRate * 100).toFixed(4)),
      serviceFeeRate: String(+(c.serviceFeeRate * 100).toFixed(4)),
      payoutDelayDays: String(c.payoutDelayDays),
      bankDescriptionHint: c.bankDescriptionHint ?? "",
    });
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    const res = await upsertOTAChannelConfig({
      id: editing?.id,
      propertyId: form.propertyId,
      platform: form.platform,
      payoutModel: form.payoutModel as "PER_BOOKING" | "BATCHED" | "DIRECT_PAY",
      commissionRate: parseFloat(form.commissionRate) / 100,
      serviceFeeRate: parseFloat(form.serviceFeeRate) / 100,
      payoutDelayDays: parseInt(form.payoutDelayDays) || 7,
      bankDescriptionHint: form.bankDescriptionHint || undefined,
    });
    setSaving(false);
    if (res.ok) {
      setShowModal(false);
      window.location.reload();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this channel config?")) return;
    await deleteOTAChannelConfig(id);
    setConfigs(prev => prev.filter(c => c.id !== id));
  }

  async function handleSeedDefaults(propertyId: string) {
    await seedDefaultOTAChannels(propertyId);
    window.location.reload();
  }

  // ── Reconcile handlers ─────────────────────────────────────────────────────

  function handlePlatformChange(p: string) {
    setReconcilePlatform(p);
    const hints: Record<string, string[]> = {
      BOOKING_COM: ["BOOKING.COM BV", "15", "2.1"],
      LEKKERSLAAP: ["LEKKESLAAP", "15", "2.07"],
      AIRBNB: ["NDS*AIRBNB", "3.45", "0"],
    };
    const [, comm, svc] = hints[p] ?? [];
    setForm(prev => ({ ...prev, commissionRate: comm ?? prev.commissionRate, serviceFeeRate: svc ?? prev.serviceFeeRate }));
  }

  async function handlePreview() {
    if (!reconcileFile) return;
    setPreviewing(true);
    setPreview(null);
    setReconcileError(null);
    setSelected(new Set());

    const fd = new FormData();
    fd.append("file", reconcileFile);
    fd.append("platform", reconcilePlatform);
    fd.append("propertyId", reconcilePropertyId);

    const res = await previewOTAReconciliation(fd);
    setPreviewing(false);
    if (res.ok && Array.isArray(res.data)) {
      const items = res.data as ReconcilePreviewItem[];
      setPreview(items);
      // Auto-select all HIGH-confidence unreconciled matches
      const autoSelect = new Set(
        items
          .filter(i => i.matchConfidence === "HIGH" && !i.alreadyReconciled)
          .map(i => i.descriptor)
      );
      setSelected(autoSelect);
    } else {
      setReconcileError((res as { ok: false; error: string }).error ?? "Preview failed");
    }
  }

  async function handleConfirm() {
    if (!reconcileFile || !preview) return;
    setConfirming(true);
    setReconcileError(null);

    const matchMap: Record<string, string> = {};
    for (const item of preview) {
      if (item.bankTransactionId) matchMap[item.descriptor] = item.bankTransactionId;
    }

    const fd = new FormData();
    fd.append("file", reconcileFile);
    fd.append("platform", reconcilePlatform);
    fd.append("propertyId", reconcilePropertyId);
    fd.append("selected", JSON.stringify([...selected]));
    fd.append("matchMap", JSON.stringify(matchMap));

    const res = await confirmOTAReconciliation(fd);
    setConfirming(false);
    if (res.ok && res.data) {
      setReconcileResult(res.data as { saved: number });
      setPreview(null);
    } else {
      setReconcileError((res as { ok: false; error: string }).error ?? "Confirm failed");
    }
  }

  const fmt = (n: number) => `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div>
      <PageHeader
        title="OTA Channels & Reconciliation"
        description="Configure payout channels and reconcile OTA statements against bank transactions"
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 w-fit">
        {(["channels", "reconcile"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-blue-500 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "channels" ? "Channel Config" : "Reconcile"}
          </button>
        ))}
      </div>

      {/* ── CHANNEL CONFIG TAB ─────────────────────────────────────────────── */}
      {tab === "channels" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-400">{configs.length} channel{configs.length !== 1 ? "s" : ""} configured</p>
            <div className="flex gap-2">
              {properties.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleSeedDefaults(p.id)}
                  className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
                >
                  Seed defaults for {p.name}
                </button>
              ))}
              <button
                onClick={openAdd}
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors"
              >
                + Add Channel
              </button>
            </div>
          </div>

          {configs.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
              <p className="text-gray-500 text-sm mb-3">No channels configured yet.</p>
              <p className="text-gray-600 text-xs">Click "Seed defaults" to pre-fill Booking.com, Airbnb, and Lekkerslaap for a property.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {configs.map(c => (
                <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className={`text-xs px-2 py-1 rounded-lg border font-medium ${platformBadgeColor(c.platform)}`}>
                      {PLATFORM_LABELS[c.platform]}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{c.property.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {c.payoutModel === "PER_BOOKING" ? "Per Booking" : c.payoutModel === "BATCHED" ? "Batched" : "Direct Pay"}
                        {" · "}Commission {(c.commissionRate * 100).toFixed(2)}%
                        {c.serviceFeeRate > 0 && ` + ${(c.serviceFeeRate * 100).toFixed(2)}% fee`}
                        {" · "}{c.payoutDelayDays}d delay
                        {c.bankDescriptionHint && ` · "${c.bankDescriptionHint}"`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(c)} className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs text-gray-400 hover:text-white transition-colors">Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="px-3 py-1.5 rounded-lg border border-red-800/50 text-xs text-red-400 hover:text-red-300 transition-colors">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── RECONCILE TAB ─────────────────────────────────────────────────── */}
      {tab === "reconcile" && (
        <div>
          {reconcileResult && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 mb-6">
              <p className="text-sm text-emerald-400 font-semibold">
                ✓ {reconcileResult.saved} payout{reconcileResult.saved !== 1 ? "s" : ""} reconciled
              </p>
              <button onClick={() => setReconcileResult(null)} className="text-xs text-gray-500 mt-1 underline">Reconcile another</button>
            </div>
          )}

          {!reconcileResult && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Property</label>
                  <select
                    value={reconcilePropertyId}
                    onChange={e => setReconcilePropertyId(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">OTA Platform</label>
                  <select
                    value={reconcilePlatform}
                    onChange={e => handlePlatformChange(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="BOOKING_COM">Booking.com</option>
                    <option value="LEKKERSLAAP">Lekkerslaap</option>
                    <option value="AIRBNB">Airbnb (coming soon)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">OTA Statement CSV</label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={e => { setReconcileFile(e.target.files?.[0] ?? null); setPreview(null); }}
                    className="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-500/10 file:text-blue-400 hover:file:bg-blue-500/20 file:cursor-pointer"
                  />
                </div>
              </div>
              <button
                onClick={handlePreview}
                disabled={!reconcileFile || previewing}
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {previewing ? "Analysing..." : "Preview Matches"}
              </button>
            </div>
          )}

          {reconcileError && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-6">
              <p className="text-sm text-red-400">{reconcileError}</p>
            </div>
          )}

          {preview && preview.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl mb-6">
              <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">{preview.length} payout{preview.length !== 1 ? "s" : ""} found</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {preview.filter(i => i.matchConfidence === "HIGH").length} matched · {preview.filter(i => i.matchConfidence === "NONE").length} unmatched
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelected(new Set(preview.filter(i => !i.alreadyReconciled).map(i => i.descriptor)))} className="text-xs text-blue-400 hover:text-blue-300">Select all</button>
                  <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-400">Clear</button>
                </div>
              </div>

              <div className="divide-y divide-gray-800">
                {preview.map(item => (
                  <div key={item.descriptor} className={`px-6 py-4 flex items-start gap-4 ${item.alreadyReconciled ? "opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      checked={selected.has(item.descriptor)}
                      disabled={item.alreadyReconciled || item.matchConfidence === "NONE"}
                      onChange={e => {
                        const next = new Set(selected);
                        e.target.checked ? next.add(item.descriptor) : next.delete(item.descriptor);
                        setSelected(next);
                      }}
                      className="mt-1 accent-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-500 truncate">{item.descriptor.slice(0, 20)}</span>
                        {item.alreadyReconciled && <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Already reconciled</span>}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                          item.matchConfidence === "HIGH" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-gray-700 text-gray-400 border-gray-600"
                        }`}>
                          {item.matchConfidence}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-gray-500">Payout date</p>
                          <p className="text-white">{new Date(item.payoutDate).toLocaleDateString("en-ZA")}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">OTA net</p>
                          <p className="text-emerald-400 font-semibold">{fmt(item.payoutAmount)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Reservations</p>
                          <p className="text-white">{item.reservationCount} · Gross {fmt(item.grossTotal)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Commission</p>
                          <p className="text-red-400">−{fmt(item.commissionTotal)}</p>
                        </div>
                      </div>

                      {item.bankTransactionId && (
                        <div className="mt-2 bg-gray-800/50 rounded-lg px-3 py-2 text-xs">
                          <span className="text-gray-500">Bank match: </span>
                          <span className="text-white">{fmt(item.bankAmount ?? 0)}</span>
                          <span className="text-gray-500"> on {item.bankDate ? new Date(item.bankDate).toLocaleDateString("en-ZA") : "—"} · </span>
                          <span className="text-gray-400 truncate">{item.bankDescription?.slice(0, 60)}</span>
                        </div>
                      )}
                      {!item.bankTransactionId && (
                        <div className="mt-2 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400">
                          ⚠ No bank transaction found — may not be imported yet
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
                <p className="text-xs text-gray-500">{selected.size} payout{selected.size !== 1 ? "s" : ""} selected</p>
                <button
                  onClick={handleConfirm}
                  disabled={selected.size === 0 || confirming}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {confirming ? "Saving..." : `Confirm ${selected.size} reconciliation${selected.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}

          {preview && preview.length === 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
              <p className="text-gray-500 text-sm">No payouts found in this file.</p>
            </div>
          )}
        </div>
      )}

      {/* ── ADD/EDIT MODAL ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-white mb-5">
              {editing ? "Edit Channel" : "Add OTA Channel"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Property</label>
                <select value={form.propertyId} onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500">
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Platform</label>
                <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value as OTAPlatform }))}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500">
                  {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Payout Model</label>
                <select value={form.payoutModel} onChange={e => setForm(f => ({ ...f, payoutModel: e.target.value }))}
                  className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500">
                  {PAYOUT_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Commission %</label>
                  <input type="number" step="0.01" value={form.commissionRate}
                    onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Service Fee %</label>
                  <input type="number" step="0.01" value={form.serviceFeeRate}
                    onChange={e => setForm(f => ({ ...f, serviceFeeRate: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Payout Delay (days)</label>
                  <input type="number" value={form.payoutDelayDays}
                    onChange={e => setForm(f => ({ ...f, payoutDelayDays: e.target.value }))}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Bank Description Hint</label>
                  <input type="text" value={form.bankDescriptionHint}
                    onChange={e => setForm(f => ({ ...f, bankDescriptionHint: e.target.value }))}
                    placeholder="e.g. BOOKING.COM BV"
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white w-full focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-700 text-sm text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
