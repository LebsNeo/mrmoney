"use client";

import { useState, useTransition, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { saveWhatsAppConnection, deleteWhatsAppConnection } from "./whatsapp-actions";

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
const EMBEDDED_CONFIG_ID = process.env.NEXT_PUBLIC_META_EMBEDDED_CONFIG_ID ?? "";

interface Connection {
  id: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string;
  isActive: boolean;
}

interface Props {
  connection: Connection | null;
  webhookUrl: string;
  verifyToken: string;
}

export function WhatsAppConnectionClient({ connection, webhookUrl, verifyToken }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [newConnection, setNewConnection] = useState<Connection | null>(connection);
  const searchParams = useSearchParams();

  const [form, setForm] = useState({
    phoneNumberId: connection?.phoneNumberId ?? "",
    accessToken: "",
    wabaId: connection?.wabaId ?? "",
    displayPhone: connection?.displayPhone ?? "",
    appSecret: "",
  });

  // Handle redirect-back from Facebook OAuth
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success === "1") {
      showToast("✓ WhatsApp connected! You're live.", true);
      window.history.replaceState({}, "", "/settings/whatsapp");
      // Reload to fetch updated connection from server
      setTimeout(() => window.location.reload(), 1500);
    } else if (error) {
      const msgs: Record<string, string> = {
        cancelled: "Signup cancelled.",
        no_waba: "No WhatsApp Business Account found. Please go to facebook.com/settings/?tab=business_tools → remove RoomKudu → then try again.",
        no_phone: "No phone numbers on your WABA. Add one in Meta Business Manager.",
        failed: searchParams.get("msg") ? `Error: ${searchParams.get("msg")}` : "Connection failed. Please try again.",
      };
      showToast(msgs[error] ?? "Something went wrong.", false);
      window.history.replaceState({}, "", "/settings/whatsapp");
    }
  }, [searchParams]);

  function handleEmbeddedSignup() {
    const appUrl = "https://www.mrca.co.za";
    const redirectUri = encodeURIComponent(`${appUrl}/api/whatsapp/oauth-callback`);
    const extras = encodeURIComponent(JSON.stringify({
      setup: { channel: "whatsapp_embedded_signup" },
      featureType: "whatsapp_embedded_signup",
      sessionInfoVersion: "3",
    }));
    const params = [
      `client_id=${META_APP_ID}`,
      `redirect_uri=${redirectUri}`,
      `response_type=code`,
      `scope=whatsapp_business_management,whatsapp_business_messaging,business_management,manage_app_solution`,
      EMBEDDED_CONFIG_ID ? `config_id=${EMBEDDED_CONFIG_ID}` : "",
      `extras=${extras}`,
      `override_default_response_type=true`,
    ].filter(Boolean).join("&");
    window.location.href = `https://www.facebook.com/dialog/oauth?${params}`;
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleSave() {
    if (!form.phoneNumberId || !form.accessToken || !form.wabaId || !form.displayPhone) {
      showToast("All fields except App Secret are required", false);
      return;
    }
    startTransition(async () => {
      const res = await saveWhatsAppConnection(form);
      if (res.ok) {
        showToast("✓ WhatsApp connected!", true);
        setEditing(false);
      } else {
        showToast(res.error ?? "Failed to save", false);
      }
    });
  }

  function handleDelete() {
    if (!confirm("Disconnect WhatsApp? Incoming messages will stop being routed to your account.")) return;
    startTransition(async () => {
      await deleteWhatsAppConnection();
      showToast("Disconnected", true);
      setEditing(true);
    });
  }

  const displayConnection = newConnection ?? connection;

  return (
    <>
      {/* FB SDK loaded via useEffect — no Next.js Script needed */}

    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">💬</span>
          <div>
            <h2 className="text-sm font-semibold text-white">WhatsApp Connection</h2>
            <p className="text-xs text-gray-500">Your business WhatsApp number linked to MrCA</p>
          </div>
        </div>
        {displayConnection && !editing && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            ● Connected
          </span>
        )}
        {!displayConnection && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
            Not connected
          </span>
        )}
      </div>

      <div className="p-6 space-y-6">
        {toast && (
          <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${
            toast.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                     : "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            {toast.msg}
          </div>
        )}

        {/* Webhook info — only relevant once connected */}
        {displayConnection && <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-400">Webhook — Configure in Meta Business Manager</p>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Callback URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-white bg-gray-800 px-3 py-2 rounded-lg font-mono truncate">{webhookUrl}</code>
              <button onClick={() => copy(webhookUrl, "webhook")} className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">
                {copied === "webhook" ? "✓" : "Copy"}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Verify Token</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-white bg-gray-800 px-3 py-2 rounded-lg font-mono truncate">{verifyToken}</code>
              <button onClick={() => copy(verifyToken, "verify")} className="shrink-0 text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">
                {copied === "verify" ? "✓" : "Copy"}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-600">Subscribe to the <strong className="text-gray-400">messages</strong> field after saving.</p>
        </div>}

        {/* ── CONNECTED STATE ─────────────────────────────────────────── */}
        {displayConnection && !editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">Phone Number</p>
                <p className="text-sm text-white font-medium">{displayConnection.displayPhone}</p>
              </div>
              <div className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">Phone Number ID</p>
                <p className="text-sm text-white font-mono truncate">{displayConnection.phoneNumberId}</p>
              </div>
              <div className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">WABA ID</p>
                <p className="text-sm text-white font-mono truncate">{displayConnection.wabaId}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEmbeddedSignup}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Reconnect / Change number
              </button>
              <button
                onClick={() => setEditing(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Enter credentials manually
              </button>
              <button onClick={handleDelete} disabled={isPending} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* ── NOT CONNECTED STATE ─────────────────────────────────────── */}
        {!displayConnection && !editing && (
          <div className="space-y-4">
            {/* Primary: Embedded Signup */}
            {META_APP_ID && (
              <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 rounded-2xl p-6 text-center space-y-4">
                <p className="text-2xl">💬</p>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">Connect in 2 minutes</p>
                  <p className="text-xs text-gray-400">
                    Click below to log in with Facebook and connect your WhatsApp Business number.
                    No credentials to copy — it's all automatic.
                  </p>
                </div>
                <button
                  onClick={handleEmbeddedSignup}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition-colors"
                >
                  {(
                    <>
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3l-.5 3H13v6.8C17.56 20.87 21 16.84 21 12c0-5.52-4.48-10-9-10z"/></svg>
                      Connect WhatsApp with Facebook
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-600"></p>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-xs text-gray-600">or enter credentials manually</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            <button
              onClick={() => setEditing(true)}
              className="w-full text-center text-xs text-gray-500 hover:text-gray-300 py-2 transition-colors"
            >
              I have my Meta credentials →
            </button>
          </div>
        )}

        {/* ── MANUAL FORM ─────────────────────────────────────────────── */}
        {editing && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Enter your Meta credentials manually</p>
            <p className="text-xs text-gray-600">Find these in Meta for Developers → your app → WhatsApp → API Setup</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Display Phone Number <span className="text-gray-600">(e.g. +27 69 500 7856)</span></label>
                <input
                  value={form.displayPhone}
                  onChange={e => setForm(f => ({ ...f, displayPhone: e.target.value }))}
                  placeholder="+27 69 500 7856"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Phone Number ID</label>
                <input
                  value={form.phoneNumberId}
                  onChange={e => setForm(f => ({ ...f, phoneNumberId: e.target.value }))}
                  placeholder="1033385233190839"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">WABA ID <span className="text-gray-600">(WhatsApp Business Account ID)</span></label>
                <input
                  value={form.wabaId}
                  onChange={e => setForm(f => ({ ...f, wabaId: e.target.value }))}
                  placeholder="906149332346974"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">App Secret <span className="text-gray-600">(optional)</span></label>
                <input
                  type="password"
                  value={form.appSecret}
                  onChange={e => setForm(f => ({ ...f, appSecret: e.target.value }))}
                  placeholder="Leave blank to use platform default"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-400 mb-1.5">Access Token <span className="text-red-400">*</span></label>
                <input
                  type="password"
                  value={form.accessToken}
                  onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))}
                  placeholder="EAAa..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-xs text-gray-600 mt-1">Permanent system user token recommended. Temporary tokens expire in 60 days.</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isPending}
                className="btn-primary"
              >
                {isPending ? "Connecting..." : "Connect WhatsApp"}
              </button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl text-sm bg-gray-800 text-gray-400 hover:text-white transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
