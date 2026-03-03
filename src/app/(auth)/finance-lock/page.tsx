"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function FinanceLockInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/transactions";

  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

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
        // PIN is required — focus first input
        inputs.current[0]?.focus();
      }
    }).catch(() => {
      inputs.current[0]?.focus();
    });
  }, []);

  function handleChange(i: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...pin];
    next[i] = val;
    setPin(next);
    setError(null);
    if (val && i < 3) inputs.current[i + 1]?.focus();
    // Auto-submit when all 4 filled
    if (val && i === 3) {
      const full = [...next].join("");
      if (full.length === 4) submit(full);
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !pin[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  async function submit(code?: string) {
    const pinStr = code ?? pin.join("");
    if (pinStr.length < 4) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/finance-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinStr }),
      });

      if (res.ok) {
        // Hard redirect so middleware re-evaluates with the new cookie
        window.location.href = returnTo;
      } else {
        const d = await res.json();
        setError(d.error ?? "Incorrect PIN");
        setPin(["", "", "", ""]);
        inputs.current[0]?.focus();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
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

        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-6">
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={loading}
              className={`w-14 h-14 text-center text-2xl font-bold rounded-2xl border-2 bg-gray-900 text-white focus:outline-none transition-colors
                ${digit ? "border-emerald-500" : "border-gray-700"}
                ${error ? "border-red-500 animate-shake" : ""}
                focus:border-emerald-500 disabled:opacity-50`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}

        {/* Submit */}
        <button
          onClick={() => submit()}
          disabled={loading || pin.join("").length < 4}
          className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Verifying..." : "Unlock Finance"}
        </button>

        <button
          onClick={() => router.push("/dashboard")}
          className="mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors"
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
