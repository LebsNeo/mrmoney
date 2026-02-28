"use client";

import { useState, useEffect, useTransition } from "react";
import { PageHeader } from "@/components/PageHeader";
import { addICalFeed, deleteICalFeed, triggerFeedSync, triggerAllSync } from "@/lib/actions/ical";
import { OTAPlatform } from "@prisma/client";
import { formatDate } from "@/lib/utils";

const PLATFORMS: { value: OTAPlatform; label: string; emoji: string }[] = [
  { value: "BOOKING_COM", label: "Booking.com", emoji: "🔵" },
  { value: "AIRBNB", label: "Airbnb", emoji: "🔴" },
  { value: "LEKKERSLAAP", label: "Lekkerslaap", emoji: "🟢" },
  { value: "EXPEDIA", label: "Expedia", emoji: "🟡" },
];

interface Feed {
  id: string;
  feedName: string;
  platform: OTAPlatform;
  icalUrl: string;
  isActive: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  propertyId: string;
  roomId: string | null;
  property: { name: string };
  room: { name: string } | null;
}

interface Property { id: string; name: string; rooms: { id: string; name: string }[] }

interface SyncResult {
  feedId: string; feedName: string; created: number; updated: number; skipped: number; error: string | null;
}

export default function ICalPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [form, setForm] = useState({
    propertyId: "",
    roomId: "",
    platform: "BOOKING_COM" as OTAPlatform,
    feedName: "",
    icalUrl: "",
  });

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [feedsRes, propsRes] = await Promise.all([
        fetch("/api/ical/feeds"),
        fetch("/api/user/properties?withRooms=true"),
      ]);
      const feedsData = await feedsRes.json();
      const propsData = await propsRes.json();
      setFeeds(feedsData.data ?? []);
      const props = propsData.data ?? propsData;
      setProperties(Array.isArray(props) ? props : []);
      if (Array.isArray(props) && props.length > 0 && !form.propertyId) {
        setForm(f => ({ ...f, propertyId: props[0].id }));
      }
    } catch {
      showToast("Failed to load feeds", false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleAdd() {
    if (!form.propertyId || !form.feedName.trim() || !form.icalUrl.trim()) {
      showToast("Property, name and URL are required", false); return;
    }
    startTransition(async () => {
      try {
        await addICalFeed({
          propertyId: form.propertyId,
          roomId: form.roomId || null,
          platform: form.platform,
          feedName: form.feedName.trim(),
          icalUrl: form.icalUrl.trim(),
        });
        setForm(f => ({ ...f, feedName: "", icalUrl: "", roomId: "" }));
        setShowAdd(false);
        showToast("Feed added ✓", true);
        await loadData();
      } catch { showToast("Failed to add feed", false); }
    });
  }

  async function handleDelete(feedId: string, name: string) {
    if (!confirm(`Remove feed "${name}"?`)) return;
    startTransition(async () => {
      await deleteICalFeed(feedId);
      showToast("Feed removed", true);
      await loadData();
    });
  }

  async function handleSync(feedId: string) {
    startTransition(async () => {
      const result = await triggerFeedSync(feedId);
      setSyncResults([result]);
      showToast(
        result.error ? `Sync failed: ${result.error}` :
        `✓ ${result.created} new · ${result.updated} updated · ${result.skipped} unchanged`,
        !result.error
      );
      await loadData();
    });
  }

  async function handleSyncAll() {
    startTransition(async () => {
      showToast("Syncing all feeds...", true);
      const results = await triggerAllSync();
      setSyncResults(results);
      const total = results.reduce((s, r) => s + r.created, 0);
      const errors = results.filter(r => r.error).length;
      showToast(
        errors > 0 ? `Sync complete · ${total} new bookings · ${errors} errors` :
        `✓ All feeds synced · ${total} new bookings imported`,
        errors === 0
      );
      await loadData();
    });
  }

  const rooms = properties.find(p => p.id === form.propertyId)?.rooms ?? [];
  const platformEmoji = (p: string) => PLATFORMS.find(pl => pl.value === p)?.emoji ?? "📅";

  return (
    <div>
      <PageHeader
        title="Channel Manager"
        description="Sync bookings from Booking.com, Airbnb and Lekkerslaap via iCal"
        action={
          <div className="flex gap-2">
            <button
              onClick={handleSyncAll}
              disabled={isPending || feeds.length === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50"
            >
              {isPending ? "Syncing..." : "🔄 Sync All"}
            </button>
            <button
              onClick={() => setShowAdd(v => !v)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-800 border border-gray-700 text-white hover:bg-gray-700 transition-colors"
            >
              + Add Feed
            </button>
          </div>
        }
      />

      {/* Toast */}
      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${
          toast.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                   : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Add feed form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">Add iCal Feed</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Property</label>
              <select
                value={form.propertyId}
                onChange={e => setForm(f => ({ ...f, propertyId: e.target.value, roomId: "" }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Room (optional — leave blank for Airbnb whole-property feeds)</label>
              <select
                value={form.roomId}
                onChange={e => setForm(f => ({ ...f, roomId: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Whole property</option>
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Platform</label>
              <select
                value={form.platform}
                onChange={e => setForm(f => ({ ...f, platform: e.target.value as OTAPlatform }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.emoji} {p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Feed name</label>
              <input
                value={form.feedName}
                onChange={e => setForm(f => ({ ...f, feedName: e.target.value }))}
                placeholder="e.g. Room 1, Velvet Lux"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-1.5">iCal URL</label>
            <input
              value={form.icalUrl}
              onChange={e => setForm(f => ({ ...f, icalUrl: e.target.value }))}
              placeholder="https://ical.booking.com/v1/export?t=..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isPending}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50"
            >
              {isPending ? "Adding..." : "Add Feed"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm bg-gray-800 text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sync results */}
      {syncResults.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Last Sync Results</h3>
          <div className="space-y-1.5">
            {syncResults.map(r => (
              <div key={r.feedId} className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${r.error ? "bg-red-500/10 text-red-400" : "bg-gray-800 text-gray-300"}`}>
                <span className="font-medium">{r.feedName}</span>
                {r.error ? (
                  <span>{r.error}</span>
                ) : (
                  <span className="text-emerald-400">+{r.created} new · {r.updated} updated · {r.skipped} unchanged</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feeds table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Loading feeds...</div>
      ) : feeds.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-400 text-sm font-medium">No iCal feeds yet</p>
          <p className="text-gray-600 text-xs mt-1">Add feeds from Booking.com, Airbnb and Lekkerslaap to start syncing bookings automatically.</p>
          <button onClick={() => setShowAdd(true)} className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-400 transition-colors">
            + Add your first feed
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {["Platform", "Feed Name", "Property", "Room", "Last Sync", "Status", ""].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {feeds.map(feed => (
                  <tr key={feed.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-base mr-2">{platformEmoji(feed.platform)}</span>
                      <span className="text-xs text-gray-300">{feed.platform.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-3 text-white font-medium">{feed.feedName}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{feed.property?.name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{feed.room?.name ?? "All rooms"}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {feed.lastSyncAt ? formatDate(new Date(feed.lastSyncAt)) : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      {feed.lastError ? (
                        <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-lg" title={feed.lastError}>⚠ Error</span>
                      ) : feed.lastSyncAt ? (
                        <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg">✓ OK</span>
                      ) : (
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-lg">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleSync(feed.id)}
                          disabled={isPending}
                          className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          Sync
                        </button>
                        <button
                          onClick={() => handleDelete(feed.id, feed.feedName)}
                          disabled={isPending}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5 text-xs text-blue-300/70 space-y-1">
        <p className="font-semibold text-blue-400 text-sm">ℹ️ How iCal sync works</p>
        <p>• Booking.com & Airbnb sync availability only — guest details are not shared for privacy reasons.</p>
        <p>• Lekkerslaap shares full guest info: name, email, phone, and reference code.</p>
        <p>• Syncing is on-demand — click "Sync All" or schedule auto-sync via a cron job.</p>
        <p>• Duplicate bookings are automatically prevented using the booking UID from each OTA.</p>
      </div>
    </div>
  );
}
