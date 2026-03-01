"use client";

import { Suspense, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// ── Inner component uses useSearchParams — must be inside Suspense ─────────────
function RegisterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get("verify") === "1";
  const registeredEmail = searchParams.get("email") ?? "";
  const [form, setForm] = useState({ name: "", email: "", password: "", organisationName: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Registration failed. Please try again.");
        return;
      }
      router.push(`/register?verify=1&email=${encodeURIComponent(form.email)}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (justRegistered) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <span className="text-3xl font-bold text-white">Mr<span className="text-emerald-400">Money</span></span>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-blue-500" />
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 text-3xl">✉️</div>
              <h1 className="text-2xl font-bold text-white mb-2">Check your inbox</h1>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                We&apos;ve sent a verification email to{" "}
                <span className="text-white font-medium">{registeredEmail}</span>.
                <br />Click the link in the email to activate your account.
              </p>
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 mb-6 text-left space-y-2">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">What to do next</p>
                {["Check your inbox (and spam / junk folder)", "Click the \"Verify Email Address\" button", "You'll be redirected to sign in"].map((step, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-sm text-gray-300">{step}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600">Didn&apos;t receive it? <ResendLink email={registeredEmail} /></p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Mr<span className="text-emerald-400">Money</span></h1>
          <p className="text-gray-400 text-sm mt-2">Hospitality Financial OS</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-white mb-1">Create your account</h2>
          <p className="text-gray-400 text-sm mb-6">Get started — free forever on the basics</p>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-5">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Your name</label>
              <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Lebohang Neo" required autoFocus className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Business / property name</label>
              <input type="text" value={form.organisationName} onChange={(e) => set("organisationName", e.target.value)} placeholder="GolfBnB Hospitality" required className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Email address</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" required className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Password</label>
              <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Minimum 8 characters" required minLength={8} className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2">
              {loading ? "Creating account..." : "Create account →"}
            </button>
          </form>
          <p className="text-center text-xs text-gray-500 mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <RegisterInner />
    </Suspense>
  );
}

function ResendLink({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  async function handleResend() {
    setLoading(true);
    try {
      await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      setSent(true);
    } finally { setLoading(false); }
  }
  if (sent) return <span className="text-emerald-400">Email resent ✓</span>;
  return <button onClick={handleResend} disabled={loading} className="text-emerald-400 hover:text-emerald-300 underline disabled:opacity-50">{loading ? "Sending…" : "Resend verification email"}</button>;
}
