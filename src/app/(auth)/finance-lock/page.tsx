"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function FinanceLockInner() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/transactions";

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-unlock if org has no PIN set
    fetch("/api/auth/finance-unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: "__auto__" }),
    }).then(async (res) => {
      if (res.ok) {
        window.location.href = returnTo;
      } else {
        inputRef.current?.focus();
      }
    }).catch(() => {
      inputRef.current?.focus();
    });
  }, []);

  async function submit(code: string) {
    if (code.length < 4) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/finance-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: code }),
      });

      if (res.ok) {
        window.location.href = returnTo;
      } else {
        const d = await res.json();
        setError(d.error ?? "Incorrect PIN");
        setPin("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setPin(val);
    setError(null);
    if (val.length === 4) submit(val);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 mb-6 text-3xl">
          🔐
        </div>

        <h1 className="text-xl font-bold text-white mb-1">Finance PIN</h1>
        <p className="text-sm text-gray-500 mb-8">
          Enter your PIN to access financial data
        </p>

        {/* PIN display boxes + hidden real input */}
        <div className="relative flex justify-center gap-4 mb-6" onClick={() => inputRef.current?.focus()}>
          {/* Hidden real input */}
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={handleChange}
            disabled={loading}
            className="absolute opacity-0 w-0 h-0"
            autoFocus
          />
          {/* Visual boxes */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold transition-colors cursor-text
                ${error ? "border-red-500" : pin.length > i ? "border-emerald-500 bg-emerald-500/10" : i === pin.length ? "border-emerald-500/50 bg-gray-900" : "border-gray-700 bg-gray-900"}
              `}
            >
              {pin[i] ? "●" : ""}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}

        {/* Submit button */}
        <button
          onClick={() => submit(pin)}
          disabled={loading || pin.length < 4}
          className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {loading ? "Verifying..." : "Unlock Finance"}
        </button>

        <button
          onClick={() => { window.location.href = "/dashboard"; }}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default function FinanceLockPage() {
  return (
    <Suspense>
      <FinanceLockInner />
    </Suspense>
  );
}
