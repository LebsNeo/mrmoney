"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [invite, setInvite] = useState<{ email: string; organisationId: string; role: string; orgName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) { setError("No invite token provided"); setLoading(false); return; }
    fetch(`/api/team/accept-invite?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); }
        else { setInvite(data); }
      })
      .catch(() => setError("Failed to verify invite"))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/team/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), password }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setSuccess(true); }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const roleLabel = invite ? invite.role.charAt(0) + invite.role.slice(1).toLowerCase() : "";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#030712" }}>
        <div style={{ width: 32, height: 32, border: "3px solid rgba(16,185,129,0.2)", borderTop: "3px solid #10b981", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#030712", padding: 24 }}>
        <div style={{ maxWidth: 440, width: "100%", background: "#111", border: "1px solid #1f1f1f", borderRadius: 20, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 8 }}>You&apos;re in!</h1>
          <p style={{ fontSize: 15, color: "#6b7280", marginBottom: 32 }}>
            Your account has been created. You can now sign in and start working with your team.
          </p>
          <Link href="/login" style={{
            display: "inline-block", padding: "14px 32px", background: "#10b981", color: "#fff",
            fontSize: 15, fontWeight: 700, textDecoration: "none", borderRadius: 12,
          }}>
            Sign In →
          </Link>
        </div>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#030712", padding: 24 }}>
        <div style={{ maxWidth: 440, width: "100%", background: "#111", border: "1px solid #1f1f1f", borderRadius: 20, padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Invalid Invite</h1>
          <p style={{ fontSize: 15, color: "#6b7280", marginBottom: 32 }}>{error}</p>
          <Link href="/login" style={{ fontSize: 14, color: "#10b981", textDecoration: "none" }}>Go to login →</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#030712", padding: 24 }}>
      <div style={{ maxWidth: 440, width: "100%", background: "#111", border: "1px solid #1f1f1f", borderRadius: 20, padding: 48 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>Mr<span style={{ color: "#10b981" }}>CA</span></span>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "16px 0 8px" }}>Join {invite?.orgName}</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            You&apos;ve been invited as a <span style={{ color: "#10b981", fontWeight: 600 }}>{roleLabel}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 500 }}>Email</label>
            <input type="email" value={invite?.email ?? ""} disabled
              style={{ width: "100%", padding: "12px 14px", background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 10, color: "#4b5563", fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 500 }}>Your Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
              style={{ width: "100%", padding: "12px 14px", background: "#0d0d0d", border: "1px solid #262626", borderRadius: 10, color: "#fff", fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 500 }}>Password *</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters"
              style={{ width: "100%", padding: "12px 14px", background: "#0d0d0d", border: "1px solid #262626", borderRadius: 10, color: "#fff", fontSize: 14, boxSizing: "border-box" }} />
          </div>

          {error && <p style={{ fontSize: 13, color: "#ef4444", marginBottom: 16 }}>{error}</p>}

          <button type="submit" disabled={submitting} style={{
            width: "100%", padding: "14px", background: "#10b981", color: "#fff", fontSize: 15,
            fontWeight: 700, border: "none", borderRadius: 12, cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.6 : 1,
          }}>
            {submitting ? "Creating account..." : "Create Account & Join"}
          </button>
        </form>

        <p style={{ fontSize: 12, color: "#374151", textAlign: "center", marginTop: 24 }}>
          Already have an account? <Link href="/login" style={{ color: "#10b981", textDecoration: "none" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
