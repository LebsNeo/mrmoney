"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ExpenseModal } from "./ExpenseModal";

const ACTIONS = [
  {
    key: "expense-scan",
    label: "Scan Receipt",
    icon: "📸",
    color: "bg-emerald-500 hover:bg-emerald-400",
  },
  {
    key: "expense-manual",
    label: "Add Expense",
    icon: "✏️",
    color: "bg-blue-600 hover:bg-blue-500",
  },
  {
    key: "invoice",
    label: "Send Invoice",
    icon: "✉️",
    color: "bg-violet-600 hover:bg-violet-500",
  },
  {
    key: "booking",
    label: "New Booking",
    icon: "📅",
    color: "bg-amber-500 hover:bg-amber-400",
  },
] as const;

type ActionKey = (typeof ACTIONS)[number]["key"];

export function QuickActionFAB() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<"expense-scan" | "expense-manual" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleAction(key: ActionKey) {
    setOpen(false);
    if (key === "expense-scan" || key === "expense-manual") {
      setModal(key);
    } else if (key === "invoice") {
      router.push("/invoices");
    } else if (key === "booking") {
      router.push("/bookings/new");
    }
  }

  return (
    <>
      {/* FAB */}
      <div
        ref={ref}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex flex-col items-end gap-3"
      >
        {/* Action items — fan upward */}
        {open && (
          <div className="flex flex-col items-end gap-2.5 mb-1 animate-in slide-in-from-bottom-2 fade-in duration-200">
            {[...ACTIONS].reverse().map((action) => (
              <button
                key={action.key}
                onClick={() => handleAction(action.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-xl transition-all ${action.color}`}
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Main FAB button */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-14 h-14 rounded-full shadow-2xl text-white text-2xl flex items-center justify-center transition-all duration-300 ${
            open
              ? "bg-gray-700 rotate-45 shadow-gray-900/50"
              : "bg-emerald-500 hover:bg-emerald-400 hover:scale-110 shadow-emerald-500/30"
          }`}
          aria-label="Quick actions"
        >
          {open ? "×" : "+"}
        </button>
      </div>

      {/* Modals */}
      {modal === "expense-scan" && (
        <ExpenseModal defaultMode="scan" onClose={() => setModal(null)} />
      )}
      {modal === "expense-manual" && (
        <ExpenseModal defaultMode="manual" onClose={() => setModal(null)} />
      )}
    </>
  );
}
