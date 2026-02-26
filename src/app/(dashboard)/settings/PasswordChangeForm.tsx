"use client";

import { useState, useTransition } from "react";
import { updatePassword } from "./actions";

export function PasswordChangeForm() {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    startTransition(async () => {
      const result = await updatePassword(form.currentPassword, form.newPassword);
      if (result.success) {
        setSuccess(result.message ?? "Password updated.");
        setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        setError(result.message ?? "Failed to update password.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          {success}
        </div>
      )}

      <div>
        <label className="block text-sm text-gray-400 mb-1">Current password</label>
        <input
          type="password"
          name="currentPassword"
          value={form.currentPassword}
          onChange={handleChange}
          required
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">New password</label>
        <input
          type="password"
          name="newPassword"
          value={form.newPassword}
          onChange={handleChange}
          required
          minLength={8}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1">Confirm new password</label>
        <input
          type="password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={handleChange}
          required
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
      >
        {isPending ? "Updating…" : "Update Password"}
      </button>
    </form>
  );
}
