"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  token: string;
  chatId: string;
  userName: string;
}

export function TelegramConnectClient({ token, chatId, userName }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [done, setDone]       = useState(false);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/telegram/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-white mb-2">Telegram Connected!</h1>
          <p className="text-sm text-gray-400 mb-6">
            Your MrCA account is now linked. Go back to the bot and type{" "}
            <span className="text-emerald-400 font-mono">/help</span> to get started.
          </p>
          <button
            onClick={() => router.push("/settings")}
            className="btn-primary w-full"
          >
            Back to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">📱</div>
          <h1 className="text-xl font-bold text-white">Connect Telegram</h1>
          <p className="text-sm text-gray-400 mt-1">
            Link your Telegram account to MrCA
          </p>
        </div>

        {/* Info card */}
        <div className="bg-gray-800 rounded-xl p-4 space-y-3 mb-6 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">MrCA Account</span>
            <span className="text-white font-medium">{userName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Telegram Chat ID</span>
            <span className="text-white font-mono text-xs">{chatId}</span>
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-6 text-center">
          By confirming, you'll be able to use the MrCA staff bot on Telegram with your account permissions.
        </p>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
            ⚠️ {error}
          </p>
        )}

        <div className="flex gap-3">
          <a
            href="/settings"
            className="btn-secondary flex-1 text-center"
          >
            Cancel
          </a>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="btn-primary flex-1"
          >
            {loading ? "Connecting…" : "✅ Confirm & Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}
