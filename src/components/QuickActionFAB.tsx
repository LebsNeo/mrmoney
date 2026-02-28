"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ExpenseModal } from "./ExpenseModal";

const ACTIONS = [
  {
    key: "booking",
    label: "New Booking",
    desc: "Add a direct booking",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5" />
      </svg>
    ),
    accent: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400",
    dot: "bg-amber-400",
  },
  {
    key: "invoice",
    label: "Send Invoice",
    desc: "Create & send to client",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
      </svg>
    ),
    accent: "from-violet-500/20 to-violet-500/5 border-violet-500/20 text-violet-400",
    dot: "bg-violet-400",
  },
  {
    key: "expense-manual",
    label: "Add Expense",
    desc: "Log a business expense",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    accent: "from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400",
    dot: "bg-blue-400",
  },
  {
    key: "expense-scan",
    label: "Scan Receipt",
    desc: "AI receipt capture",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
      </svg>
    ),
    accent: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400",
    dot: "bg-emerald-400",
  },
] as const;

type ActionKey = (typeof ACTIONS)[number]["key"];

export function QuickActionFAB() {
  const router = useRouter();
  const [open, setOpen]   = useState(false);
  const [modal, setModal] = useState<"expense-scan" | "expense-manual" | null>(null);
  const [visible, setVisible] = useState(true); // scroll-to-hide
  const ref       = useRef<HTMLDivElement>(null);
  const lastScroll = useRef(0);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll-to-hide on mobile — hide when scrolling down, show when scrolling up or stopped
  useEffect(() => {
    let ticking = false;
    let hideTimer: ReturnType<typeof setTimeout>;

    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const current = window.scrollY;
          const isMobile = window.innerWidth < 768;

          if (isMobile) {
            if (current > lastScroll.current + 8) {
              // scrolling down — hide
              setVisible(false);
              setOpen(false);
            } else if (current < lastScroll.current - 8) {
              // scrolling up — show
              setVisible(true);
            }
            lastScroll.current = current;

            // Always show when near bottom
            const nearBottom = (window.innerHeight + current) >= document.body.scrollHeight - 80;
            if (nearBottom) setVisible(true);
          } else {
            setVisible(true);
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
      <div
        ref={ref}
        className={`fixed bottom-20 right-4 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-3 transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"
        }`}
      >
        {/* Action menu */}
        {open && (
          <div className="flex flex-col items-end gap-2 mb-1">
            {[...ACTIONS].map((action, i) => (
              <button
                key={action.key}
                onClick={() => handleAction(action.key)}
                style={{ animationDelay: `${i * 40}ms` }}
                className={`
                  group flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-2xl
                  glass border bg-gradient-to-r ${action.accent}
                  text-sm font-semibold shadow-xl
                  transition-all duration-200 hover:scale-[1.03] hover:shadow-2xl
                  animate-in slide-in-from-bottom-3 fade-in duration-200
                `}
              >
                {/* Icon bubble */}
                <div className={`w-7 h-7 rounded-xl bg-gradient-to-br ${action.accent.split(" ")[0]} ${action.accent.split(" ")[1]} flex items-center justify-center shrink-0`}>
                  {action.icon}
                </div>
                {/* Text */}
                <div className="text-left">
                  <p className="leading-none">{action.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 font-normal">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Main FAB ───────────────────────────── */}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label="Quick actions"
          className={`
            relative w-14 h-14 rounded-full flex items-center justify-center
            shadow-2xl transition-all duration-300
            ${open
              ? "bg-gray-800/90 backdrop-blur-xl border border-white/10 rotate-45 scale-95"
              : "bg-gradient-to-br from-emerald-400 to-emerald-600 hover:scale-110 shadow-emerald-500/40 hover:shadow-emerald-500/60"
            }
          `}
        >
          {/* Pulse ring — only when closed */}
          {!open && (
            <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping opacity-75" />
          )}
          <svg
            className={`w-6 h-6 text-white transition-transform duration-300 ${open ? "rotate-0" : ""}`}
            fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
          >
            {open
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
            }
          </svg>
        </button>
      </div>

      {/* Modals */}
      {modal === "expense-scan"   && <ExpenseModal defaultMode="scan"   onClose={() => setModal(null)} />}
      {modal === "expense-manual" && <ExpenseModal defaultMode="manual" onClose={() => setModal(null)} />}
    </>
  );
}
