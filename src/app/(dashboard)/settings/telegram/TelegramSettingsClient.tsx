"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  isConnected: boolean;
}

export function TelegramSettingsClient({ isConnected }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleDisconnect() {
    if (!confirm("Disconnect your Telegram account? You'll need to send /start again to reconnect.")) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/telegram/unlink", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <p className="text-sm text-gray-400">
        Follow the steps below to connect your Telegram account.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-blue-300">
        <span>✅</span>
        <span>Your Telegram is linked to this MrCA account. The bot is ready to use.</span>
      </div>
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          ⚠️ {error}
        </p>
      )}
      <button
        onClick={handleDisconnect}
        disabled={loading}
        className="text-xs text-red-400 hover:text-red-300 underline transition-colors disabled:opacity-50"
      >
        {loading ? "Disconnecting…" : "Disconnect Telegram"}
      </button>
    </div>
  );
}
