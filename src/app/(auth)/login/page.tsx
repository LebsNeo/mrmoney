"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ErrorState =
  | { kind: "generic"; message: string }
  | { kind: "unverified"; email: string }
  | null;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ErrorState>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "EMAIL_NOT_VERIFIED") {
          setError({ kind: "unverified", email });
        } else if (result.error === "CredentialsSignin") {
          setError({ kind: "generic", message: "Invalid email or password. Please try again." });
        } else if (result.error?.toLowerCase().includes("network") || result.error?.toLowerCase().includes("fetch")) {
          setError({ kind: "generic", message: "Network error. Please check your connection and try again." });
        } else {
          setError({ kind: "generic", message: "Something went wrong. Please try again or contact support." });
        }
      } else if (result?.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError({ kind: "generic", message: "Login failed. Please try again." });
      }
    } catch {
      setError({ kind: "generic", message: "Network error. Please check your connection." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500 mb-4">
            <span className="text-2xl font-bold text-white">M</span>
          </div>
          <h1 className="text-2xl font-bold text-white">MrCA</h1>
          <p className="text-gray-400 text-sm mt-1">Hospitality Financial OS</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-2">Welcome back</h2>
          <p className="text-gray-400 text-sm mb-6">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@property.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            {error?.kind === "generic" && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-red-400 text-sm">{error.message}</p>
              </div>
            )}

            {error?.kind === "unverified" && (
              <UnverifiedBanner email={error.email} />
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white font-semibold transition-colors mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-5 space-y-3 text-center">
            <p className="text-xs text-gray-500">
              <Link href="/forgot-password" className="text-emerald-400 hover:text-emerald-300 font-medium">
                Forgot your password?
              </Link>
            </p>
            <p className="text-xs text-gray-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-emerald-400 hover:text-emerald-300 font-medium">
                Sign up free →
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          © {new Date().getFullYear()} MrCA. All rights reserved.
        </p>
      </div>
    </div>
  );
}

function UnverifiedBanner({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleResend() {
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

  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-amber-400 text-lg shrink-0">✉</span>
        <div>
          <p className="text-sm font-semibold text-amber-300">Email not verified</p>
          <p className="text-xs text-amber-400/80 mt-0.5 leading-relaxed">
            Check your inbox for the verification link we sent to{" "}
            <span className="font-medium text-amber-300">{email}</span>.
          </p>
        </div>
      </div>
      {sent ? (
        <p className="text-xs text-emerald-400 pl-7">✓ New verification email sent — check your inbox.</p>
      ) : (
        <button
          onClick={handleResend}
          disabled={loading}
          className="ml-7 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 disabled:opacity-50 transition-colors"
        >
          {loading ? "Sending…" : "Resend verification email"}
        </button>
      )}
    </div>
  );
}
