"use client";

import { useState, useTransition } from "react";
import { saveWhatsAppConnection, deleteWhatsAppConnection } from "./whatsapp-actions";

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
  const [editing, setEditing] = useState(!connection);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [form, setForm] = useState({
    phoneNumberId: connection?.phoneNumberId ?? "",
    accessToken: "",
    wabaId: connection?.wabaId ?? "",
    displayPhone: connection?.displayPhone ?? "",
    appSecret: "",
  });

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

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">💬</span>
          <div>
            <h2 className="text-sm font-semibold text-white">WhatsApp Connection</h2>
            <p className="text-xs text-gray-500">Your business WhatsApp number linked to MrCA</p>
          </div>
        </div>
        {connection && !editing && (
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            ● Connected
          </span>
        )}
        {!connection && (
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

        {/* Webhook info */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-400">Step 1 — Configure webhook in Meta Business Manager</p>
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
        </div>

        {/* Connected display */}
        {connection && !editing && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">Phone Number</p>
                <p className="text-sm text-white font-medium">{connection.displayPhone}</p>
              </div>
              <div className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">Phone Number ID</p>
                <p className="text-sm text-white font-mono truncate">{connection.phoneNumberId}</p>
              </div>
              <div className="bg-gray-800 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-500 mb-0.5">WABA ID</p>
                <p className="text-sm text-white font-mono truncate">{connection.wabaId}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors">
                Update credentials
              </button>
              <button onClick={handleDelete} disabled={isPending} className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* Connection form */}
        {editing && (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 2 — Enter your Meta credentials</p>
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
                <label className="block text-xs text-gray-400 mb-1.5">App Secret <span className="text-gray-600">(optional, for signature verification)</span></label>
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
              {connection && (
                <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl text-sm bg-gray-800 text-gray-400 hover:text-white transition-colors">
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
