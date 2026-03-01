"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

type State = "verifying" | "success" | "already" | "error" | "expired";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [state, setState] = useState<State>("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [redirectIn, setRedirectIn] = useState(5);

  useEffect(() => {
    if (!token) { setState("error"); setErrorMsg("No verification token found."); return; }

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setState(data.data?.alreadyVerified ? "already" : "success");
        } else {
          const msg: string = data.error ?? "";
          setState(msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("invalid") ? "expired" : "error");
          setErrorMsg(msg);
        }
      })
      .catch(() => { setState("error"); setErrorMsg("Something went wrong. Please try again."); });
  }, [token]);

  // Auto-redirect after success
  useEffect(() => {
    if (state !== "success") return;
    const t = setInterval(() => {
      setRedirectIn(n => {
        if (n <= 1) { clearInterval(t); router.push("/login"); return 0; }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state, router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/">
            <span className="text-3xl font-bold text-white">
              Mr<span className="text-emerald-400">Money</span>
            </span>
          </Link>
          <p className="text-gray-500 text-sm mt-1">Hospitality Financial OS</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {/* Top accent */}
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-blue-500" />

          <div className="p-8 text-center">

            {/* VERIFYING */}
            {state === "verifying" && (
              <>
                <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
                  <svg className="w-7 h-7 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-white mb-2">Verifying your email…</h1>
                <p className="text-gray-500 text-sm">Just a moment, please don't close this tab.</p>
              </>
            )}

            {/* SUCCESS */}
            {state === "success" && (
              <>
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">Email verified!</h1>
                <p className="text-gray-400 text-sm mb-6">
                  Your MrMoney account is now active. You'll receive a welcome email shortly.
                </p>
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 mb-6">
                  <p className="text-xs text-emerald-400">
                    Redirecting to login in {redirectIn}s…
                  </p>
                </div>
                <Link
                  href="/login"
                  className="block w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors"
                >
                  Sign in now →
                </Link>
              </>
            )}

            {/* ALREADY VERIFIED */}
            {state === "already" && (
              <>
                <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-white mb-2">Already verified</h1>
                <p className="text-gray-400 text-sm mb-6">Your email address is already verified. Sign in to continue.</p>
                <Link
                  href="/login"
                  className="block w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors"
                >
                  Sign in →
                </Link>
              </>
            )}

            {/* EXPIRED */}
            {state === "expired" && (
              <>
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-white mb-2">Link expired</h1>
                <p className="text-gray-400 text-sm mb-6">
                  This verification link has expired (links are valid for 72 hours). Request a new one below.
                </p>
                <ResendButton />
              </>
            )}

            {/* ERROR */}
            {state === "error" && (
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-white mb-2">Verification failed</h1>
                <p className="text-gray-400 text-sm mb-6">{errorMsg || "Something went wrong. Please try again."}</p>
                <ResendButton />
              </>
            )}

          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Need help?{" "}
          <a href="mailto:support@mrmoney.app" className="text-gray-500 hover:text-gray-400">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}

function ResendButton() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleResend() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
        <p className="text-sm text-emerald-400">✓ Verification email sent — check your inbox (including spam).</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Enter your email address"
        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
      />
      <button
        onClick={handleResend}
        disabled={loading || !email.trim()}
        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors disabled:opacity-50"
      >
        {loading ? "Sending…" : "Resend verification email"}
      </button>
    </div>
  );
}
