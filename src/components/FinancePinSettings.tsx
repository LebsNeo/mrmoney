"use client";

import { useState } from "react";

interface Props {
  hasPin: boolean;
}

export function FinancePinSettings({ hasPin: initialHasPin }: Props) {
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [mode, setMode] = useState<"idle" | "set" | "remove">("idle");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function reset() {
    setMode("idle");
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setMsg(null);
  }

  async function handleSet() {
    if (newPin.length < 4) return setMsg({ ok: false, text: "PIN must be at least 4 digits" });
    if (newPin !== confirmPin) return setMsg({ ok: false, text: "PINs do not match" });
    if (!/^\d+$/.test(newPin)) return setMsg({ ok: false, text: "PIN must be digits only" });
    setLoading(true);
    setMsg(null);

    const res = await fetch("/api/auth/finance-set-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: newPin, currentPin: hasPin ? currentPin : undefined }),
    });
    const d = await res.json();
    setLoading(false);

    if (res.ok) {
      setHasPin(true);
      setMsg({ ok: true, text: hasPin ? "PIN updated successfully." : "Finance PIN set! Finance section is now locked." });
      setMode("idle");
      setCurrentPin(""); setNewPin(""); setConfirmPin("");
    } else {
      setMsg({ ok: false, text: d.error ?? "Failed to set PIN" });
    }
  }

  async function handleRemove() {
    if (!currentPin) return setMsg({ ok: false, text: "Enter your current PIN to remove it" });
    setLoading(true);
    setMsg(null);

    const res = await fetch("/api/auth/finance-set-pin", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: currentPin }),
    });
    const d = await res.json();
    setLoading(false);

    if (res.ok) {
      setHasPin(false);
      setMsg({ ok: true, text: "Finance PIN removed. Finance section is now open to all staff." });
      setMode("idle");
      setCurrentPin("");
    } else {
      setMsg({ ok: false, text: d.error ?? "Failed to remove PIN" });
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            🔐 Finance PIN Lock
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Protect financial data with a PIN. Staff see bookings and operations — only PIN holders see money.
          </p>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${hasPin ? "bg-emerald-500/10 text-emerald-400" : "bg-gray-800 text-gray-500"}`}>
          {hasPin ? "🔒 Active" : "🔓 Off"}
        </span>
      </div>

      {/* Status */}
      {!hasPin && mode === "idle" && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-400">
            ⚠ No PIN set — all logged-in users can view financial data.
          </p>
        </div>
      )}

      {/* Actions */}
      {mode === "idle" && (
        <div className="flex gap-2">
          <button
            onClick={() => { setMode("set"); setMsg(null); }}
            className="btn-primary"
          >
            {hasPin ? "Change PIN" : "Set PIN"}
          </button>
          {hasPin && (
            <button
              onClick={() => { setMode("remove"); setMsg(null); }}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
            >
              Remove PIN
            </button>
          )}
        </div>
      )}

      {/* Set PIN form */}
      {mode === "set" && (
        <div className="space-y-3">
          {hasPin && (
            <div>
              <label className="text-xs text-gray-400 block mb-1">Current PIN</label>
              <input type="password" inputMode="numeric" maxLength={8} value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter current PIN"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          )}
          <div>
            <label className="text-xs text-gray-400 block mb-1">New PIN (4–8 digits)</label>
            <input type="password" inputMode="numeric" maxLength={8} value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 1234"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Confirm new PIN</label>
            <input type="password" inputMode="numeric" maxLength={8} value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Repeat PIN"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          {msg && <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
          <div className="flex gap-2">
            <button onClick={handleSet} disabled={loading}
              className="btn-primary">
              {loading ? "Saving..." : "Save PIN"}
            </button>
            <button onClick={reset} className="px-4 py-2 rounded-xl text-sm bg-gray-800 text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Remove PIN form */}
      {mode === "remove" && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Confirm your current PIN to remove it</label>
            <input type="password" inputMode="numeric" maxLength={8} value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter current PIN"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          {msg && <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
          <div className="flex gap-2">
            <button onClick={handleRemove} disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-400 text-white transition-colors disabled:opacity-50">
              {loading ? "Removing..." : "Remove PIN"}
            </button>
            <button onClick={reset} className="px-4 py-2 rounded-xl text-sm bg-gray-800 text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Success msg when idle */}
      {mode === "idle" && msg && (
        <p className={`text-xs mt-3 ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>
      )}
    </div>
  );
}
