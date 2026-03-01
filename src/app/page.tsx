import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "MrMoney — Hospitality Financial OS",
  description:
    "The financial operating system built for African guesthouses, lodges and boutique hotels. Real-time revenue, OTA reconciliation, occupancy intelligence — all in one place.",
};

// ─── Static data ──────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "📊",
    title: "Live Financial Dashboard",
    body: "Cash position, revenue, and P&L the moment you open the app. No spreadsheets. No guesswork.",
  },
  {
    icon: "🏨",
    title: "Occupancy & RevPAR Intelligence",
    body: "Occupancy rate, ADR, and RevPAR per room — tracked automatically from your bookings.",
  },
  {
    icon: "🔄",
    title: "OTA Reconciliation",
    body: "Upload your Booking.com, Airbnb, or Lekkerslaap statement. MrMoney matches payouts to bank transactions in seconds.",
  },
  {
    icon: "📈",
    title: "Channel Mix Analytics",
    body: "See exactly how much revenue came from each channel, commission costs, and average daily rate — per month.",
  },
  {
    icon: "💰",
    title: "Payroll & UIF",
    body: "Run monthly payroll, calculate UIF correctly, issue payslips, and track advances — SA-compliant out of the box.",
  },
  {
    icon: "🧾",
    title: "Invoices & Expenses",
    body: "Branded invoices sent via email, AI receipt scanning, bank statement import — finance captured at the source.",
  },
];

const PAIN_POINTS = [
  {
    before: "Logging into QuickBooks feels like homework",
    after: "Open MrMoney — your numbers are already there",
  },
  {
    before: "Reconciling Booking.com takes 2 hours every month",
    after: "Upload the CSV. Done in 30 seconds.",
  },
  {
    before: "You don't know which rooms are dragging RevPAR",
    after: "Room-level occupancy and revenue — always visible",
  },
  {
    before: "Payroll is a manual mess every month end",
    after: "Run payroll in 3 clicks. UIF calculated automatically.",
  },
];

const STATS = [
  { value: "< 30s", label: "Daily check-in time" },
  { value: "3", label: "OTAs reconciled automatically" },
  { value: "100%", label: "SA-compliant (BCEA, UIF, VAT)" },
  { value: "R0", label: "To get started" },
];

// ─── Components ───────────────────────────────────────────────────────────────

function GradientText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={className}
      style={{
        background: "linear-gradient(135deg, #10b981 0%, #34d399 40%, #38bdf8 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      {children}
    </span>
  );
}

function NavBar() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        background: "rgba(3,7,18,0.8)",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "linear-gradient(135deg,#10b981,#059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            M
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>
            Mr<span style={{ color: "#10b981" }}>Money</span>
          </span>
        </div>

        {/* Nav links — hidden on mobile */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
          }}
          className="hidden-mobile"
        >
          {["Features", "How it works", "Pricing"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
              style={{
                fontSize: 14,
                color: "#9ca3af",
                textDecoration: "none",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = "#fff")}
              onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = "#9ca3af")}
            >
              {item}
            </a>
          ))}
        </nav>

        {/* CTAs */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/login"
            style={{
              fontSize: 14,
              color: "#9ca3af",
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: 10,
              transition: "color 0.15s",
            }}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: "linear-gradient(135deg,#10b981,#059669)",
              padding: "9px 20px",
              borderRadius: 10,
              textDecoration: "none",
              boxShadow: "0 0 20px rgba(16,185,129,0.3)",
              transition: "opacity 0.15s",
            }}
          >
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Dashboard mockup — pure CSS, no images ──────────────────────────────────

function DashboardMockup() {
  const kpis = [
    { label: "Revenue MTD", value: "R84,320", change: "+12%", up: true },
    { label: "Occupancy", value: "73%", change: "+8%", up: true },
    { label: "ADR", value: "R1,240", change: "+5%", up: true },
    { label: "RevPAR", value: "R906", change: "+18%", up: true },
  ];
  const channels = [
    { name: "Airbnb", pct: 38, color: "#f43f5e" },
    { name: "Booking.com", pct: 31, color: "#3b82f6" },
    { name: "Direct", pct: 18, color: "#10b981" },
    { name: "Walk-in", pct: 13, color: "#14b8a6" },
  ];
  const bars = [42, 55, 38, 67, 73, 81];
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];

  return (
    <div
      style={{
        background: "#0d0d0d",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
        fontFamily: "inherit",
      }}
    >
      {/* Window chrome */}
      <div
        style={{
          background: "#111",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
        ))}
        <div
          style={{
            marginLeft: 8,
            flex: 1,
            height: 22,
            background: "#1a1a1a",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            paddingLeft: 10,
            gap: 6,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
          <span style={{ fontSize: 11, color: "#4b5563" }}>mrmoney.app/dashboard</span>
        </div>
      </div>

      {/* Dashboard content */}
      <div style={{ padding: 20 }}>
        {/* KPI grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
          {kpis.map((k) => (
            <div
              key={k.label}
              style={{
                background: "#161616",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <p style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 6px" }}>
                {k.label}
              </p>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
                {k.value}
              </p>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: k.up ? "#10b981" : "#f87171",
                  background: k.up ? "rgba(16,185,129,0.1)" : "rgba(248,113,113,0.1)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                {k.change}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom panels */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {/* Revenue chart */}
          <div
            style={{
              background: "#161616",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <p style={{ fontSize: 10, color: "#9ca3af", margin: "0 0 12px", fontWeight: 600 }}>
              6-Month Revenue
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 52 }}>
              {bars.map((h, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div
                    style={{
                      width: "100%",
                      height: `${h}%`,
                      borderRadius: "4px 4px 0 0",
                      background: i === bars.length - 1
                        ? "linear-gradient(180deg,#10b981,#059669)"
                        : "rgba(255,255,255,0.08)",
                    }}
                  />
                  <span style={{ fontSize: 8, color: "#4b5563" }}>{months[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Channel mix */}
          <div
            style={{
              background: "#161616",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <p style={{ fontSize: 10, color: "#9ca3af", margin: "0 0 10px", fontWeight: 600 }}>
              Channel Mix
            </p>
            {/* Bar */}
            <div style={{ display: "flex", height: 6, borderRadius: 4, overflow: "hidden", marginBottom: 10, gap: 1 }}>
              {channels.map((c) => (
                <div key={c.name} style={{ width: `${c.pct}%`, background: c.color }} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {channels.map((c) => (
                <div key={c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.color }} />
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>{c.name}</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#d1d5db" }}>{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ background: "#030712", minHeight: "100vh", color: "#fff" }}>
      <NavBar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        style={{ position: "relative", overflow: "hidden", padding: "100px 24px 80px" }}
      >
        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: "50%",
            transform: "translateX(-50%)",
            width: 800,
            height: 600,
            background: "radial-gradient(ellipse at center, rgba(16,185,129,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: 1120, margin: "0 auto", position: "relative" }}>
          {/* Badge */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                fontWeight: 600,
                color: "#10b981",
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
                padding: "6px 14px",
                borderRadius: 100,
                letterSpacing: "0.3px",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
              Built for South African hospitality operators
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              textAlign: "center",
              fontSize: "clamp(38px, 6vw, 72px)",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-2px",
              margin: "0 auto 24px",
              maxWidth: 840,
            }}
          >
            Your guesthouse finances,{" "}
            <GradientText>finally under control</GradientText>
          </h1>

          {/* Subheadline */}
          <p
            style={{
              textAlign: "center",
              fontSize: "clamp(16px, 2vw, 20px)",
              color: "#6b7280",
              lineHeight: 1.65,
              maxWidth: 580,
              margin: "0 auto 44px",
            }}
          >
            MrMoney connects your bookings, OTA payouts, bank statements, and
            expenses into one real-time financial picture. Built for guesthouses,
            lodges, and boutique hotels across Africa.
          </p>

          {/* CTA buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
              marginBottom: 72,
            }}
          >
            <Link
              href="/register"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                background: "linear-gradient(135deg,#10b981,#059669)",
                padding: "14px 32px",
                borderRadius: 14,
                textDecoration: "none",
                boxShadow: "0 0 40px rgba(16,185,129,0.35), 0 4px 16px rgba(0,0,0,0.3)",
                letterSpacing: "-0.2px",
              }}
            >
              Start for free
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 16,
                fontWeight: 600,
                color: "#9ca3af",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "14px 28px",
                borderRadius: 14,
                textDecoration: "none",
              }}
            >
              Sign in
            </Link>
          </div>

          {/* Dashboard mockup */}
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ──────────────────────────────────────────────────── */}
      <section
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "48px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 24,
          }}
        >
          {STATS.map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: "clamp(28px, 4vw, 42px)",
                  fontWeight: 800,
                  letterSpacing: "-1.5px",
                  margin: "0 0 6px",
                  background: "linear-gradient(135deg,#10b981,#38bdf8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {s.value}
              </p>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PAIN → GAIN ──────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#10b981", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 14 }}>
              The shift
            </p>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 48px)",
                fontWeight: 800,
                letterSpacing: "-1.5px",
                margin: 0,
              }}
            >
              Stop dreading your finances
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 2 }}>
            {PAIN_POINTS.map((p, i) => (
              <div
                key={i}
                style={{
                  background: "#0d0d0d",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  padding: "28px 28px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    background: "rgba(239,68,68,0.06)",
                    border: "1px solid rgba(239,68,68,0.12)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1.4, color: "#f87171" }}>✗</span>
                  <p style={{ fontSize: 13, color: "#f87171", margin: 0, lineHeight: 1.5 }}>{p.before}</p>
                </div>
                <div
                  style={{
                    background: "rgba(16,185,129,0.06)",
                    border: "1px solid rgba(16,185,129,0.15)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1.4, color: "#10b981" }}>✓</span>
                  <p style={{ fontSize: 13, color: "#10b981", margin: 0, lineHeight: 1.5 }}>{p.after}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section
        id="features"
        style={{
          padding: "96px 24px",
          background: "rgba(255,255,255,0.015)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#10b981", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 14 }}>
              Everything you need
            </p>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 48px)",
                fontWeight: 800,
                letterSpacing: "-1.5px",
                margin: "0 auto 16px",
                maxWidth: 600,
              }}
            >
              One platform. Every number.
            </h2>
            <p style={{ fontSize: 16, color: "#6b7280", maxWidth: 480, margin: "0 auto" }}>
              Built from the ground up for South African hospitality. Not adapted from foreign software — purpose-built.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: 16,
            }}
          >
            {FEATURES.map((f, i) => (
              <div
                key={i}
                style={{
                  background: "#0d0d0d",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 18,
                  padding: "28px 28px 24px",
                  transition: "border-color 0.2s",
                  cursor: "default",
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.borderColor = "rgba(16,185,129,0.3)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)")
                }
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    marginBottom: 18,
                  }}
                >
                  {f.icon}
                </div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "#fff",
                    margin: "0 0 10px",
                    letterSpacing: "-0.3px",
                  }}
                >
                  {f.title}
                </h3>
                <p style={{ fontSize: 14, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OTA LOGOS STRIP ──────────────────────────────────────────────── */}
      <section style={{ padding: "56px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#4b5563", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 32 }}>
            Reconciles directly with
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 40,
              flexWrap: "wrap",
            }}
          >
            {[
              { name: "Booking.com", color: "#3b82f6" },
              { name: "Airbnb", color: "#f43f5e" },
              { name: "Lekkerslaap", color: "#f59e0b" },
              { name: "Capitec Business", color: "#8b5cf6" },
              { name: "Standard Bank", color: "#10b981" },
            ].map((brand) => (
              <div
                key={brand.name}
                style={{
                  padding: "10px 22px",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 700, color: brand.color }}>
                  {brand.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section
        id="pricing"
        style={{
          padding: "96px 24px",
          background: "rgba(255,255,255,0.015)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#10b981", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 14 }}>
              Pricing
            </p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", margin: "0 0 16px" }}>
              Simple. No surprises.
            </h2>
            <p style={{ fontSize: 16, color: "#6b7280" }}>
              Start free. Upgrade when you grow.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 20,
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            {/* Free */}
            <div
              style={{
                background: "#0d0d0d",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 20,
                padding: "36px 32px",
              }}
            >
              <p style={{ fontSize: 13, color: "#6b7280", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>
                Starter
              </p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-2px", color: "#fff" }}>R0</span>
                <span style={{ fontSize: 14, color: "#6b7280", paddingBottom: 10 }}>/month</span>
              </div>
              <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 28 }}>
                Perfect for getting started
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                {["1 property", "Manual bookings", "Bank import", "P&L report", "Email support"].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#10b981", fontSize: 14 }}>✓</span>
                    <span style={{ fontSize: 14, color: "#9ca3af" }}>{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/register"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "13px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                  textDecoration: "none",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                Get started free
              </Link>
            </div>

            {/* Pro — featured */}
            <div
              style={{
                background: "linear-gradient(160deg, #0a1f16 0%, #0d0d0d 100%)",
                border: "1px solid rgba(16,185,129,0.3)",
                borderRadius: 20,
                padding: "36px 32px",
                position: "relative",
                boxShadow: "0 0 60px rgba(16,185,129,0.08)",
              }}
            >
              {/* Popular badge */}
              <div
                style={{
                  position: "absolute",
                  top: -12,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 14px",
                  borderRadius: 100,
                  letterSpacing: "0.5px",
                  whiteSpace: "nowrap",
                }}
              >
                Most popular
              </div>
              <p style={{ fontSize: 13, color: "#10b981", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>
                Pro
              </p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 6 }}>
                <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-2px", color: "#fff" }}>R499</span>
                <span style={{ fontSize: 14, color: "#6b7280", paddingBottom: 10 }}>/month</span>
              </div>
              <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 28 }}>
                For operators serious about growth
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
                {[
                  "Unlimited properties",
                  "OTA reconciliation",
                  "Intelligence & RevPAR",
                  "Payroll & UIF",
                  "Invoices & receipts",
                  "Cash flow reports",
                  "Priority support",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#10b981", fontSize: 14 }}>✓</span>
                    <span style={{ fontSize: 14, color: "#d1d5db" }}>{item}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/register"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "13px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#fff",
                  textDecoration: "none",
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  boxShadow: "0 0 24px rgba(16,185,129,0.3)",
                }}
              >
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section style={{ padding: "120px 24px" }}>
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            textAlign: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 600,
              height: 400,
              background: "radial-gradient(ellipse, rgba(16,185,129,0.08) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <h2
            style={{
              fontSize: "clamp(32px, 5vw, 58px)",
              fontWeight: 800,
              letterSpacing: "-1.5px",
              margin: "0 0 20px",
              lineHeight: 1.1,
              position: "relative",
            }}
          >
            Your numbers deserve{" "}
            <GradientText>a better home</GradientText>
          </h2>
          <p
            style={{
              fontSize: 18,
              color: "#6b7280",
              marginBottom: 40,
              lineHeight: 1.6,
              position: "relative",
            }}
          >
            Join hospitality operators who've stopped dreading month-end and
            started making smarter decisions every day.
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap", position: "relative" }}>
            <Link
              href="/register"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                background: "linear-gradient(135deg,#10b981,#059669)",
                padding: "16px 36px",
                borderRadius: 14,
                textDecoration: "none",
                boxShadow: "0 0 50px rgba(16,185,129,0.4), 0 4px 20px rgba(0,0,0,0.4)",
                letterSpacing: "-0.2px",
              }}
            >
              Create your free account
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
          <p style={{ fontSize: 12, color: "#374151", marginTop: 20 }}>
            No credit card required · Setup in under 5 minutes
          </p>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          padding: "40px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
              Mr<span style={{ color: "#10b981" }}>Money</span>
            </span>
            <span style={{ fontSize: 12, color: "#374151" }}>· Hospitality Financial OS</span>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/login" style={{ fontSize: 13, color: "#4b5563", textDecoration: "none" }}>
              Sign in
            </Link>
            <Link href="/register" style={{ fontSize: 13, color: "#4b5563", textDecoration: "none" }}>
              Register
            </Link>
            <span style={{ fontSize: 12, color: "#1f2937" }}>
              © {new Date().getFullYear()} MrMoney. All rights reserved.
            </span>
          </div>
        </div>
      </footer>

      {/* ── Mobile styles ─────────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 640px) {
          .hidden-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
