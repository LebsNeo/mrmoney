"use client";

import { useState, useEffect, useTransition } from "react";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-purple-500/10 text-purple-400",
  MANAGER: "bg-blue-500/10 text-blue-400",
  ACCOUNTANT: "bg-amber-500/10 text-amber-400",
  STAFF: "bg-gray-500/10 text-gray-400",
};

export function TeamManagement({ userRole }: { userRole: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MANAGER");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const canInvite = userRole === "OWNER" || userRole === "MANAGER";

  function showToastMsg(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 5000);
  }

  async function loadMembers() {
    try {
      const res = await fetch("/api/team");
      const data = await res.json();
      setMembers(data.data ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { loadMembers(); }, []);

  function handleInvite() {
    if (!inviteEmail.trim()) { showToastMsg("Email is required", false); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) { showToastMsg("Invalid email", false); return; }

    startTransition(async () => {
      try {
        const res = await fetch("/api/team/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
        });
        const data = await res.json();
        if (data.ok) {
          showToastMsg(`Invite sent to ${inviteEmail}`, true);
          setInviteEmail("");
          setShowInvite(false);
        } else {
          showToastMsg(data.error ?? "Failed to send invite", false);
        }
      } catch {
        showToastMsg("Something went wrong", false);
      }
    });
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-base">Team</h2>
          <p className="text-xs text-gray-500 mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInvite(v => !v)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            + Invite
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`px-4 py-2.5 rounded-xl text-sm font-medium border ${
          toast.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                   : "bg-red-500/10 border-red-500/20 text-red-400"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-sm text-gray-300 font-medium">Invite a team member</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="colleague@email.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="MANAGER">Manager</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleInvite}
              disabled={isPending}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-white transition-colors disabled:opacity-50"
            >
              {isPending ? "Sending..." : "Send Invite"}
            </button>
            <button
              onClick={() => setShowInvite(false)}
              className="px-4 py-2 rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-600">They&apos;ll receive an email with a link to create their account and join your organisation.</p>
        </div>
      )}

      {/* Members list */}
      {loading ? (
        <div className="py-6 text-center text-gray-500 text-sm">Loading team...</div>
      ) : (
        <div className="divide-y divide-gray-800">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{m.name}</p>
                <p className="text-xs text-gray-500 truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role] ?? ROLE_COLORS.STAFF}`}>
                  {m.role}
                </span>
                {!m.isActive && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Inactive</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
