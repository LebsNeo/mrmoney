"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Conversation {
  id: string;
  phone: string;
  guestName: string | null;
  state: string;
  lastMessageAt: string;
  extracted: Record<string, unknown> | null;
  booking: {
    id: string;
    checkIn: string;
    checkOut: string;
    status: string;
    grossAmount: number;
  } | null;
}

interface Props {
  webhookUrl: string;
  stats: { total: number; confirmed: number; pending: number; cancelled: number };
  conversations: Conversation[];
}

const STATE_BADGE: Record<string, string> = {
  COLLECTING:  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  CONFIRMING:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CONFIRMED:   "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  CANCELLED:   "bg-gray-700/50 text-gray-400 border-gray-600",
};

const STATE_LABEL: Record<string, string> = {
  COLLECTING: "Collecting info",
  CONFIRMING: "Awaiting YES",
  CONFIRMED:  "Booked ✓",
  CANCELLED:  "Cancelled",
};

const PROVIDERS = [
  {
    id: "meta",
    name: "Meta Cloud API",
    description: "Official WhatsApp Business API. Best for production. Free up to 1k conversations/month.",
    badge: "Recommended",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    steps: [
      { n: 1, text: "Create a Meta Developer account at developers.facebook.com" },
      { n: 2, text: 'Create an app → Add "WhatsApp" product' },
      { n: 3, text: "Add a phone number and get your Phone Number ID and Access Token" },
      { n: 4, text: "Go to Webhooks → paste your Webhook URL below → set Verify Token" },
      { n: 5, text: "Subscribe to the 'messages' webhook field" },
      { n: 6, text: "Set WHATSAPP_PHONE_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET on Vercel" },
    ],
  },
  {
    id: "twilio",
    name: "Twilio WhatsApp",
    description: "Easier setup with a sandbox for testing. Good for development and smaller volumes.",
    badge: "Easy setup",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    steps: [
      { n: 1, text: "Create a Twilio account at twilio.com" },
      { n: 2, text: "Activate the WhatsApp Sandbox (or apply for a dedicated number)" },
      { n: 3, text: 'In Twilio Console → Messaging → WhatsApp → Sandbox → set "When a message comes in" to your Webhook URL' },
      { n: 4, text: "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM on Vercel" },
    ],
  },
];

export function WhatsAppSetupClient({ webhookUrl, stats, conversations }: Props) {
  const [copied, setCopied] = useState(false);
  const [activeProvider, setActiveProvider] = useState("meta");
  const [tab, setTab] = useState<"setup" | "digest" | "conversations">("setup");

  // Digest settings
  const [digestPhone, setDigestPhone] = useState("");
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestTime, setDigestTime] = useState("07:00");
  const [digestSaving, setDigestSaving] = useState(false);
  const [digestSaved, setDigestSaved] = useState(false);
  const [digestError, setDigestError] = useState("");
  const [digestSending, setDigestSending] = useState(false);
  const [digestSendResult, setDigestSendResult] = useState("");

  useEffect(() => {
    fetch("/api/settings/digest")
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          setDigestPhone(d.data.ownerWhatsApp ?? "");
          setDigestEnabled(d.data.digestEnabled ?? false);
          setDigestTime(d.data.digestTime ?? "07:00");
        }
      })
      .catch(() => {});
  }, []);

  async function saveDigest() {
    setDigestSaving(true);
    setDigestError("");
    setDigestSaved(false);
    try {
      const res = await fetch("/api/settings/digest", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerWhatsApp: digestPhone, digestEnabled, digestTime }),
      });
      const data = await res.json();
      if (!res.ok) { setDigestError(data.error ?? "Failed to save"); return; }
      setDigestSaved(true);
      setTimeout(() => setDigestSaved(false), 3000);
    } catch {
      setDigestError("Network error");
    } finally {
      setDigestSaving(false);
    }
  }

  async function sendTestDigest() {
    setDigestSending(true);
    setDigestSendResult("");
    try {
      const res = await fetch("/api/cron/daily-digest");
      const data = await res.json();
      if (data.ok) {
        setDigestSendResult(data.sent > 0 ? "✓ Digest sent! Check your WhatsApp." : "Digest not sent — make sure phone is saved and WhatsApp provider is configured.");
      } else {
        setDigestSendResult("Error: " + (data.error ?? "Unknown"));
      }
    } catch {
      setDigestSendResult("Network error");
    } finally {
      setDigestSending(false);
      setTimeout(() => setDigestSendResult(""), 6000);
    }
  }

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const provider = PROVIDERS.find((p) => p.id === activeProvider) ?? PROVIDERS[0];

  return (
    <div>
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total conversations", value: stats.total, color: "text-white" },
          { label: "Bookings confirmed", value: stats.confirmed, color: "text-emerald-400" },
          { label: "Awaiting reply", value: stats.pending, color: "text-amber-400" },
          { label: "Cancelled", value: stats.cancelled, color: "text-gray-500" },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 w-fit">
        {(["setup", "digest", "conversations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-blue-500 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {t === "setup" ? "Setup Guide" : t === "digest" ? "☀️ Daily Digest" : `Conversations ${stats.total > 0 ? `(${stats.total})` : ""}`}
          </button>
        ))}
      </div>

      {/* ── SETUP TAB ─────────────────────────────────────────────────────── */}
      {tab === "setup" && (
        <div className="space-y-6">

          {/* How it works */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4">How it works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[
                { icon: "💬", step: "Guest messages", body: "Guest sends a WhatsApp message to your business number with their dates" },
                { icon: "🤖", step: "AI extracts", body: "MrCA reads the message and extracts check-in, check-out, and guests" },
                { icon: "📋", step: "Sends summary", body: "Replies with a booking summary and asks the guest to reply YES to confirm" },
                { icon: "✅", step: "Booking created", body: "Guest replies YES → booking is created in MrCA automatically" },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="text-3xl mb-3">{s.icon}</div>
                  <p className="text-xs font-semibold text-white mb-1">{s.step}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Webhook URL */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-1">Your Webhook URL</h2>
            <p className="text-xs text-gray-500 mb-4">Paste this into your WhatsApp provider's webhook settings</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-emerald-400 font-mono overflow-x-auto">
                {webhookUrl}
              </code>
              <button
                onClick={copyWebhook}
                className="shrink-0 px-4 py-3 rounded-xl border border-gray-700 text-sm font-medium text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Provider selection */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Choose your provider</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveProvider(p.id)}
                  className={`text-left p-4 rounded-xl border transition-colors ${
                    activeProvider === p.id
                      ? "border-blue-500/50 bg-blue-500/5"
                      : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-white">{p.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{p.description}</p>
                </button>
              ))}
            </div>

            {/* Steps for selected provider */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{provider.name} — Setup steps</p>
              {provider.steps.map((s) => (
                <div key={s.n} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-gray-800 border border-gray-700 text-xs font-bold text-gray-400 flex items-center justify-center shrink-0 mt-0.5">
                    {s.n}
                  </span>
                  <p className="text-sm text-gray-300 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Required env vars */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-1">Required environment variables</h2>
            <p className="text-xs text-gray-500 mb-4">
              Add these to your{" "}
              <a
                href="https://vercel.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline"
              >
                Vercel environment variables
              </a>
            </p>
            <div className="space-y-2">
              {(activeProvider === "meta"
                ? [
                    { key: "WHATSAPP_ACCESS_TOKEN", desc: "System user access token from Meta" },
                    { key: "WHATSAPP_PHONE_ID", desc: "Phone Number ID from Meta dashboard" },
                    { key: "WHATSAPP_VERIFY_TOKEN", desc: "Any random string you choose" },
                    { key: "WHATSAPP_APP_SECRET", desc: "App secret from Meta app settings" },
                    { key: "WHATSAPP_ORG_ID", desc: "Your MrCA organisation ID" },
                  ]
                : [
                    { key: "TWILIO_ACCOUNT_SID", desc: "From Twilio console" },
                    { key: "TWILIO_AUTH_TOKEN", desc: "From Twilio console" },
                    { key: "TWILIO_WHATSAPP_FROM", desc: 'e.g. whatsapp:+14155238886' },
                    { key: "WHATSAPP_ORG_ID", desc: "Your MrCA organisation ID" },
                  ]
              ).map((env) => (
                <div key={env.key} className="flex items-start gap-3 bg-gray-800/50 rounded-xl px-4 py-3">
                  <code className="text-xs text-emerald-400 font-mono shrink-0 pt-0.5">{env.key}</code>
                  <span className="text-xs text-gray-500">{env.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Example conversation */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Example conversation</h2>
            <div className="space-y-3 max-w-sm">
              {[
                { from: "guest", text: "Hi, I'd like to book 2 nights from 20 March for 2 people" },
                { from: "bot", text: "🏠 GolfBnB — Booking Request\n\n📅 Check-in: Thu 20 Mar\n📅 Check-out: Sat 22 Mar\n🌙 Nights: 2\n🛏 Room: Garden Suite\n👥 Guests: 2\n💰 Total: R2,400\n\nReply YES to confirm." },
                { from: "guest", text: "YES" },
                { from: "bot", text: "✅ Booking confirmed! See you on 20 March. Ref: MM4X2K" },
              ].map((m, i) => (
                <div key={i} className={`flex ${m.from === "guest" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-xs px-4 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                      m.from === "guest"
                        ? "bg-gray-800 text-gray-200 rounded-tl-sm"
                        : "bg-emerald-500/15 border border-emerald-500/20 text-emerald-200 rounded-tr-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DIGEST TAB ────────────────────────────────────────────────────── */}
      {tab === "digest" && (
        <div className="space-y-6">
          {/* What is this */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <span className="text-4xl">☀️</span>
              <div>
                <h2 className="text-base font-bold text-white mb-1">Daily Morning Digest</h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Every morning at your chosen time, MrCA sends you a WhatsApp summary of the day — occupancy, check-ins, revenue MTD, cash position, and any pending bookings. One message. Total picture.
                </p>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4">What you'll receive</h2>
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs text-xs text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">
{`☀️ Good morning! Here's your day
Monday, 2 March 2026

🏠 GolfBnB
🟩🟩🟩🟩⬜ 6/8 rooms (75%)
📥 Check-ins today: 2
📤 Check-outs today: 1
💳 Revenue today: R2,200

📊 Revenue MTD: R84,320
💵 Cash position: R12,450
📈 Top channel: Airbnb (42%)

⚡ 1 WhatsApp booking awaiting confirmation

— MrCA 💚`}
              </div>
            </div>
          </div>

          {/* Settings form */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-white">Configure</h2>

            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Enable daily digest</p>
                <p className="text-xs text-gray-500 mt-0.5">Sends every morning at your chosen time</p>
              </div>
              <button
                onClick={() => setDigestEnabled(!digestEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  digestEnabled ? "bg-emerald-500" : "bg-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    digestEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Your WhatsApp number (E.164 format)
              </label>
              <input
                type="tel"
                value={digestPhone}
                onChange={(e) => setDigestPhone(e.target.value)}
                placeholder="+27821234567"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              <p className="text-xs text-gray-600 mt-1">Include country code. SA numbers: +27 followed by 9 digits</p>
            </div>

            {/* Time */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Delivery time (Africa/Johannesburg)
              </label>
              <select
                value={digestTime}
                onChange={(e) => setDigestTime(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                {["05:00", "06:00", "06:30", "07:00", "07:30", "08:00", "09:00"].map((t) => (
                  <option key={t} value={t}>{t} SAST</option>
                ))}
              </select>
            </div>

            {digestError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                {digestError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={saveDigest}
                disabled={digestSaving}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {digestSaving ? "Saving..." : digestSaved ? "✓ Saved!" : "Save settings"}
              </button>
              <button
                onClick={sendTestDigest}
                disabled={digestSending || !digestPhone}
                className="px-4 py-3 rounded-xl border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {digestSending ? "Sending..." : "Send test"}
              </button>
            </div>

            {digestSendResult && (
              <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                {digestSendResult}
              </p>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-xs text-gray-500 leading-relaxed">
              <strong className="text-gray-400">Note:</strong> The digest uses your WhatsApp provider (Meta or Twilio). Make sure your provider is configured first on the Setup Guide tab. The cron runs every day at 5:00 AM UTC (7:00 AM SAST).
            </p>
          </div>
        </div>
      )}

      {/* ── CONVERSATIONS TAB ─────────────────────────────────────────────── */}
      {tab === "conversations" && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl">
          {conversations.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-3xl mb-3">💬</p>
              <p className="text-white font-medium mb-2">No conversations yet</p>
              <p className="text-gray-500 text-sm">Once your WhatsApp webhook is live, guest conversations will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {conversations.map((c) => {
                const extracted = c.extracted;
                return (
                  <div key={c.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-white">
                          {c.guestName ?? c.phone}
                        </p>
                        <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${STATE_BADGE[c.state] ?? "bg-gray-700 text-gray-400 border-gray-600"}`}>
                          {STATE_LABEL[c.state as keyof typeof STATE_LABEL] ?? c.state}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{c.phone}</p>
                      {extracted?.checkIn ? (
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(String(extracted.checkIn)).toLocaleDateString("en-ZA")}
                          {" → "}
                          {extracted.checkOut ? new Date(String(extracted.checkOut)).toLocaleDateString("en-ZA") : "?"}
                          {extracted.roomName ? ` · ${String(extracted.roomName)}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-500">
                        {new Date(c.lastMessageAt).toLocaleDateString("en-ZA")}
                      </p>
                      {c.booking && (
                        <Link
                          href={`/bookings/${c.booking.id}`}
                          className="text-xs text-blue-400 hover:text-blue-300 mt-1 block"
                        >
                          View booking →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
