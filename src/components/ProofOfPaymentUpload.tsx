"use client";

import { useState, useRef } from "react";
import { attachProofOfPayment, removeProofOfPayment } from "@/lib/actions/bookings";
import { useToast } from "@/context/ToastContext";
import { useRouter } from "next/navigation";

interface Props {
  bookingId: string;
  existingUrl?: string | null;
  existingNote?: string | null;
}

export function ProofOfPaymentUpload({ bookingId, existingUrl, existingNote }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [note, setNote] = useState(existingNote ?? "");
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl ?? null);
  const [savingNote, setSavingNote] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/expenses/upload-receipt", { method: "POST", body: form });
      const data = await res.json();
      if (!data?.data?.url) throw new Error("Upload failed");

      const url = data.data.url;
      const result = await attachProofOfPayment(bookingId, url, note || undefined);
      if (!result.success) throw new Error(result.message);

      setPreviewUrl(url);
      showToast("Proof of payment attached ✓", "success");
      router.refresh();
    } catch (e) {
      showToast((e as Error).message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remove proof of payment? This cannot be undone.")) return;
    setRemoving(true);
    try {
      const result = await removeProofOfPayment(bookingId);
      if (!result.success) throw new Error(result.message);
      setPreviewUrl(null);
      setNote("");
      showToast("Proof of payment removed", "success");
      router.refresh();
    } catch (e) {
      showToast((e as Error).message || "Failed to remove", "error");
    } finally {
      setRemoving(false);
    }
  }

  async function handleSaveNote() {
    if (!previewUrl) return;
    setSavingNote(true);
    try {
      await attachProofOfPayment(bookingId, previewUrl, note || undefined);
      showToast("Note saved ✓", "success");
      router.refresh();
    } finally {
      setSavingNote(false);
    }
  }

  const isImage = previewUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(previewUrl);
  const isPdf   = previewUrl && /\.pdf$/i.test(previewUrl);

  return (
    <div className="space-y-4">
      {/* Existing proof */}
      {previewUrl ? (
        <div className="space-y-3">
          {/* Preview */}
          {isImage ? (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer"
              className="block rounded-xl overflow-hidden border border-gray-700 hover:border-emerald-500/50 transition-colors">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Proof of payment" className="w-full max-h-64 object-contain bg-gray-800" />
            </a>
          ) : isPdf ? (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-700 hover:border-emerald-500/50 transition-colors bg-gray-800/50">
              <span className="text-2xl">📄</span>
              <div>
                <p className="text-sm font-medium text-white">PDF Document</p>
                <p className="text-xs text-emerald-400">Click to open →</p>
              </div>
            </a>
          ) : (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-700 hover:border-emerald-500/50 transition-colors bg-gray-800/50">
              <span className="text-2xl">📎</span>
              <div>
                <p className="text-sm font-medium text-white">Proof of payment</p>
                <p className="text-xs text-emerald-400">Click to view →</p>
              </div>
            </a>
          )}

          {/* Note */}
          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add a note (e.g. Cash paid 2026-03-04 by Sipho)"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button onClick={handleSaveNote} disabled={savingNote}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
              {savingNote ? "..." : "Save"}
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex-1 py-2 rounded-xl text-xs font-semibold border border-gray-700 text-gray-400 hover:text-white hover:border-gray-600 transition-colors">
              🔄 Replace
            </button>
            <button onClick={handleRemove} disabled={removing}
              className="flex-1 py-2 rounded-xl text-xs font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">
              {removing ? "Removing..." : "🗑 Remove"}
            </button>
          </div>
        </div>
      ) : (
        /* Upload prompt */
        <div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-gray-700 hover:border-emerald-500/50 rounded-xl p-6 text-center transition-all hover:bg-emerald-500/5 disabled:opacity-50"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="text-3xl">📸</span>
                <p className="text-sm font-medium text-gray-300">Attach proof of payment</p>
                <p className="text-xs text-gray-500">Bank notification · WhatsApp screenshot · PDF · Any image</p>
              </div>
            )}
          </button>

          {/* Note field — available before upload too */}
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Add a note (e.g. Cash paid 2026-03-04 by Sipho)"
            className="w-full mt-3 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
