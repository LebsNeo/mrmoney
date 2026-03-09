/**
 * MrCA — Telegram Settings Page
 * /settings/telegram
 *
 * Shows connection status, setup instructions, and disconnect option.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/PageHeader";
import { TelegramSettingsClient } from "./TelegramSettingsClient";

export default async function TelegramSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;

  const rows = await prisma.$queryRaw<
    Array<{ name: string; telegram_chat_id: string | null; role: string }>
  >`SELECT name, telegram_chat_id, role FROM users WHERE id = ${userId} LIMIT 1`;

  const user = rows[0] ?? null;
  const isConnected = !!user?.telegram_chat_id;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Telegram"
        description="Connect Telegram to manage your property hands-free"
      />

      {/* Status card */}
      <div className={`rounded-2xl border-2 p-6 ${
        isConnected
          ? "bg-blue-950/50 border-blue-500/60"
          : "bg-gray-900 border-gray-800"
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✈️</span>
            <div>
              <h2 className={`font-bold text-base ${isConnected ? "text-blue-300" : "text-white"}`}>
                Telegram Staff Bot
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {isConnected
                  ? `Connected — Chat ID ${user?.telegram_chat_id}`
                  : "Not connected yet"}
              </p>
            </div>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
            isConnected
              ? "bg-blue-500/20 text-blue-400"
              : "bg-gray-800 text-gray-500"
          }`}>
            {isConnected ? "✅ Active" : "Not set up"}
          </span>
        </div>

        <TelegramSettingsClient isConnected={isConnected} />
      </div>

      {/* How it works */}
      {!isConnected && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold text-base">How to connect</h2>
          <ol className="space-y-4">
            {[
              {
                step: "1",
                title: "Open Telegram",
                desc: 'Search for @MrCARSA_bot or tap the button below to open the bot directly.',
              },
              {
                step: "2",
                title: 'Send "/start"',
                desc: "The bot will send you a link. Tap it — it'll open MrCA and ask you to confirm.",
              },
              {
                step: "3",
                title: "Confirm the connection",
                desc: "You'll be asked to link your MrCA account. Confirm and you're done.",
              },
              {
                step: "4",
                title: "Start talking",
                desc: 'Ask anything: "Who\'s checking in today?", "Sync my Airbnb feed", "What\'s our occupancy?"',
              },
            ].map(({ step, title, desc }) => (
              <li key={step} className="flex gap-4">
                <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <a
            href="https://t.me/MrCARSA_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
          >
            <span>✈️</span> Open @MrCARSA_bot on Telegram
          </a>
        </div>
      )}

      {/* What you can do */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold text-base mb-4">What the bot can do</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: "🌙", label: "Tonight's house", desc: "Arrivals, in-house, departures" },
            { icon: "📅", label: "Upcoming bookings", desc: "Next check-ins at a glance" },
            { icon: "🛬", label: "Check in / check out", desc: "Update guest status instantly" },
            { icon: "🔍", label: "Guest lookup", desc: "Find any booking by name or ref" },
            { icon: "📡", label: "iCal / channel manager", desc: "Link OTAs, sync feeds, get export URLs" },
            { icon: "🏨", label: "Room availability", desc: "Check free rooms for any dates" },
            { icon: "📝", label: "Booking notes", desc: "Add timestamped notes to bookings" },
            { icon: "💰", label: "Revenue (owners)", desc: "Daily, weekly, monthly income" },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-xl">
              <span className="text-xl shrink-0">{icon}</span>
              <div>
                <p className="text-xs font-semibold text-white">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <a href="/settings" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
          ← Back to Settings
        </a>
      </div>
    </div>
  );
}
