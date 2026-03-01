import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "MrMoney — Know Your Numbers Before Your First Coffee",
  description:
    "The financial operating system built for South African guesthouses, lodges and boutique hotels. Real-time KPIs, OTA reconciliation, WhatsApp bookings — all in one place.",
};

// ─── Value propositions ───────────────────────────────────────────────────────

const VALUE_PROPS = [
  {
    headline: "Know your numbers\nbefore your first coffee",
    body: "Every morning at 7am, MrMoney sends you a WhatsApp with last night's occupancy, today's check-ins, revenue MTD, and cash position. Your entire business in one message.",
    stat: "30 seconds",
    statLabel: "Daily check-in time",
    emoji: "☀️",
    accent: "#10b981",
  },
  {
    headline: "OTA reconciliation\nin under a minute",
    body: "Upload your Booking.com, Airbnb, or Lekkerslaap statement. MrMoney matches every payout to every bank transaction automatically. What used to take 2 hours now takes 30 seconds.",
    stat: "3 OTAs",
    statLabel: "Reconciled automatically",
    emoji: "🔄",
    accent: "#3b82f6",
  },
  {
    headline: "Guests book on WhatsApp.\nBookings appear in MrMoney.",
    body: "A guest messages your WhatsApp number. Our AI reads the dates, checks availability, sends a summary, and creates the booking the moment they reply YES. Zero manual entry.",
    stat: "0 clicks",
    statLabel: "To capture a WhatsApp booking",
    emoji: "💬",
    accent: "#8b5cf6",
  },
  {
    headline: "Built for SA.\nNot adapted for SA.",
    body: "Lekkerslaap, Capitec, Standard Bank, UIF, VAT, SARS — all built in from day one. Not bolted on after the fact. MrMoney is the only hospitality finance platform that actually understands the South African market.",
    stat: "100%",
    statLabel: "SA-compliant",
    emoji: "🇿🇦",
    accent: "#f59e0b",
  },
];

const PROOF_POINTS = [
  { icon: "📊", text: "Real-time RevPAR, ADR & occupancy — per room, per month" },
  { icon: "🏦", text: "Capitec & Standard Bank statement import" },
  { icon: "🧾", text: "AI receipt scanning — point camera, expense captured" },
  { icon: "💰", text: "Payroll + UIF calculated correctly, every month" },
  { icon: "📋", text: "P&L and Cash Flow statements, always up to date" },
  { icon: "📈", text: "Channel mix analytics — know which OTA earns you most" },
  { icon: "🔖", text: "Branded invoices sent via email in one click" },
  { icon: "🎯", text: "Budget alerts and break-even tracking built in" },
];

// ─── Components ───────────────────────────────────────────────────────────────

function GradientText({
  children,
  from = "#10b981",
  to = "#38bdf8",
}: {
  children: React.ReactNode;
  from?: string;
  to?: string;
}) {
  return (
    <span
      style={{
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
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
        background: "rgba(3,7,18,0.85)",
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

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href="/login"
            style={{
              fontSize: 14,
              color: "#6b7280",
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: 10,
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
            }}
          >
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
}

// ─── Dashboard mockup ─────────────────────────────────────────────────────────

function DashboardMockup() {
  const kpis = [
    { label: "Revenue MTD", value: "R84,320", change: "+12%", up: true },
    { label: "Occupancy", value: "73%", change: "+8%", up: true },
    { label: "ADR", value: "R1,240", change: "+5%", up: true },
    { label: "RevPAR", value: "R906", change: "+18%", up: true },
  ];
  const bars = [42, 55, 38, 67, 73, 81];
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const channels = [
    { name: "Airbnb", pct: 38, color: "#f43f5e" },
    { name: "Booking.com", pct: 31, color: "#3b82f6" },
    { name: "Direct", pct: 18, color: "#10b981" },
    { name: "WhatsApp", pct: 13, color: "#8b5cf6" },
  ];

  return (
    <div
      style={{
        background: "#0a0a0a",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 60px 120px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {/* Window chrome */}
      <div
        style={{
          background: "#111",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "10px 16px",
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
            height: 20,
            background: "#1a1a1a",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            paddingLeft: 10,
            gap: 6,
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
          <span style={{ fontSize: 10, color: "#374151" }}>mrmoney.app/dashboard</span>
        </div>
      </div>

      <div style={{ padding: 18 }}>
        {/* KPI grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
          {kpis.map((k) => (
            <div
              key={k.label}
              style={{
                background: "#161616",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <p style={{ fontSize: 8, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 5px" }}>
                {k.label}
              </p>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.5px" }}>
                {k.value}
              </p>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: "#10b981",
                  background: "rgba(16,185,129,0.1)",
                  padding: "1px 5px",
                  borderRadius: 3,
                }}
              >
                {k.change}
              </span>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8 }}>
          <div
            style={{
              background: "#161616",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <p style={{ fontSize: 9, color: "#6b7280", margin: "0 0 10px", fontWeight: 600 }}>
              6-Month Revenue
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 48 }}>
              {bars.map((h, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div
                    style={{
                      width: "100%",
                      height: `${h}%`,
                      borderRadius: "3px 3px 0 0",
                      background:
                        i === bars.length - 1
                          ? "linear-gradient(180deg,#10b981,#059669)"
                          : "rgba(255,255,255,0.07)",
                    }}
                  />
                  <span style={{ fontSize: 7, color: "#374151" }}>{months[i]}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "#161616",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <p style={{ fontSize: 9, color: "#6b7280", margin: "0 0 8px", fontWeight: 600 }}>
              Channel Mix
            </p>
            <div style={{ display: "flex", height: 5, borderRadius: 3, overflow: "hidden", marginBottom: 8, gap: 1 }}>
              {channels.map((c) => (
                <div key={c.name} style={{ width: `${c.pct}%`, background: c.color }} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {channels.map((c) => (
                <div key={c.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: c.color }} />
                    <span style={{ fontSize: 9, color: "#6b7280" }}>{c.name}</span>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 600, color: "#9ca3af" }}>{c.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WhatsApp mockup ──────────────────────────────────────────────────────────

function WhatsAppMockup() {
  const msgs = [
    { from: "guest", text: "Hi, I'd like to book 2 nights from Friday for 2 people" },
    {
      from: "bot",
      text: "🏠 GolfBnB — Booking Request\n\n📅 Check-in: Fri 7 Mar\n📅 Check-out: Sun 9 Mar\n🌙 Nights: 2\n🛏 Garden Suite\n👥 2 guests\n💰 Total: R2,200\n\nReply YES to confirm.",
    },
    { from: "guest", text: "YES" },
    { from: "bot", text: "✅ Booking confirmed! See you Friday. Ref: MM4X2K" },
  ];

  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        maxWidth: 320,
      }}
    >
      {/* WA header */}
      <div
        style={{
          background: "#075e54",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#25d366",
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
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>MrMoney</p>
          <p style={{ fontSize: 10, color: "#b2dfdb", margin: 0 }}>online</p>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          background: "#0b141a",
          padding: "12px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minHeight: 200,
        }}
      >
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: m.from === "guest" ? "flex-start" : "flex-end",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                background: m.from === "guest" ? "#202c33" : "#005c4b",
                borderRadius: m.from === "guest" ? "0 10px 10px 10px" : "10px 0 10px 10px",
                padding: "8px 10px",
                fontSize: 11,
                color: "#e9edef",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
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
      <section style={{ position: "relative", overflow: "hidden", padding: "90px 24px 80px" }}>
        {/* Radial glow */}
        <div
          style={{
            position: "absolute",
            top: -300,
            left: "50%",
            transform: "translateX(-50%)",
            width: 900,
            height: 700,
            background:
              "radial-gradient(ellipse at center, rgba(16,185,129,0.1) 0%, transparent 65%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ maxWidth: 1120, margin: "0 auto", position: "relative" }}>
          {/* Badge */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
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
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#10b981",
                  display: "inline-block",
                }}
              />
              Purpose-built for South African hospitality
            </span>
          </div>

          {/* Headline */}
          <h1
            style={{
              textAlign: "center",
              fontSize: "clamp(40px, 6.5vw, 80px)",
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-3px",
              margin: "0 auto 20px",
              maxWidth: 860,
            }}
          >
            Stop dreading{" "}
            <GradientText from="#10b981" to="#34d399">
              month-end.
            </GradientText>
            <br />
            Start owning your numbers.
          </h1>

          {/* Subheadline */}
          <p
            style={{
              textAlign: "center",
              fontSize: "clamp(16px, 2vw, 20px)",
              color: "#6b7280",
              lineHeight: 1.65,
              maxWidth: 560,
              margin: "0 auto 48px",
            }}
          >
            MrMoney is the financial operating system that South African
            guesthouse owners have been waiting for. Real-time numbers.
            Zero spreadsheets. Built for the way you actually work.
          </p>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
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
                padding: "15px 36px",
                borderRadius: 14,
                textDecoration: "none",
                boxShadow: "0 0 50px rgba(16,185,129,0.4), 0 4px 20px rgba(0,0,0,0.3)",
                letterSpacing: "-0.2px",
              }}
            >
              Start for free — no card needed
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/login"
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#6b7280",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                padding: "15px 28px",
                borderRadius: 14,
                textDecoration: "none",
              }}
            >
              Sign in
            </Link>
          </div>

          {/* Dashboard mockup */}
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── THE BOLD STATEMENT ───────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 24px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.01)",
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              fontSize: "clamp(22px, 3.5vw, 40px)",
              fontWeight: 800,
              letterSpacing: "-1px",
              lineHeight: 1.3,
              color: "#fff",
              margin: "0 0 24px",
            }}
          >
            "Your finance tool should feel like checking WhatsApp.{" "}
            <span style={{ color: "#10b981" }}>Not like doing homework."</span>
          </p>
          <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>
            Built by operators, for operators. We know what it feels like to run a guesthouse
            at full occupancy on a Friday night while trying to reconcile last month's Booking.com statement.
            <br />
            <span style={{ color: "#9ca3af" }}>That's exactly what we fixed.</span>
          </p>
        </div>
      </section>

      {/* ── VALUE PROPS ──────────────────────────────────────────────────── */}
      <section style={{ padding: "100px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 72 }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#10b981",
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginBottom: 12,
              }}
            >
              Why MrMoney
            </p>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 50px)",
                fontWeight: 900,
                letterSpacing: "-1.5px",
                margin: 0,
              }}
            >
              Four things that change everything
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 80 }}>
            {VALUE_PROPS.map((vp, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: i % 2 === 0 ? "1fr 1fr" : "1fr 1fr",
                  gap: 64,
                  alignItems: "center",
                }}
              >
                {/* Text side */}
                <div style={{ order: i % 2 === 0 ? 1 : 2 }}>
                  {/* Emoji pill */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      background: `rgba(${hexToRgb(vp.accent)}, 0.08)`,
                      border: `1px solid rgba(${hexToRgb(vp.accent)}, 0.2)`,
                      padding: "6px 14px",
                      borderRadius: 100,
                      marginBottom: 20,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{vp.emoji}</span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: vp.accent,
                        letterSpacing: "0.5px",
                      }}
                    >
                      {vp.statLabel}
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: "clamp(24px, 3vw, 40px)",
                      fontWeight: 900,
                      letterSpacing: "-1.5px",
                      lineHeight: 1.1,
                      margin: "0 0 20px",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {vp.headline}
                  </h3>

                  <p
                    style={{
                      fontSize: 16,
                      color: "#6b7280",
                      lineHeight: 1.7,
                      margin: "0 0 28px",
                    }}
                  >
                    {vp.body}
                  </p>

                  {/* Stat */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "baseline",
                      gap: 8,
                      padding: "16px 24px",
                      background: `rgba(${hexToRgb(vp.accent)}, 0.06)`,
                      border: `1px solid rgba(${hexToRgb(vp.accent)}, 0.15)`,
                      borderRadius: 14,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 36,
                        fontWeight: 900,
                        letterSpacing: "-2px",
                        color: vp.accent,
                      }}
                    >
                      {vp.stat}
                    </span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>{vp.statLabel}</span>
                  </div>
                </div>

                {/* Visual side */}
                <div
                  style={{
                    order: i % 2 === 0 ? 2 : 1,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  {i === 0 && <DigestPreview />}
                  {i === 1 && <OTAPreview />}
                  {i === 2 && <WhatsAppMockup />}
                  {i === 3 && <SAPreview />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROOF POINTS ─────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 24px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.01)",
        }}
      >
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 40px)", fontWeight: 900, letterSpacing: "-1.5px", margin: "0 0 12px" }}>
              Everything in one place.{" "}
              <GradientText>Nothing missing.</GradientText>
            </h2>
            <p style={{ fontSize: 16, color: "#6b7280", margin: 0 }}>
              No integrations to configure. No plugins to buy. It's all here.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 2,
            }}
          >
            {PROOF_POINTS.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "20px 24px",
                  background: "#0d0d0d",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: 14,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{p.icon}</span>
                <p style={{ fontSize: 14, color: "#9ca3af", margin: 0, lineHeight: 1.5 }}>{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OTA LOGOS ────────────────────────────────────────────────────── */}
      <section style={{ padding: "52px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              fontSize: 11,
              color: "#374151",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: 28,
            }}
          >
            Works with the platforms you already use
          </p>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {[
              { name: "Booking.com", color: "#3b82f6" },
              { name: "Airbnb", color: "#f43f5e" },
              { name: "Lekkerslaap", color: "#f59e0b" },
              { name: "Capitec Business", color: "#8b5cf6" },
              { name: "Standard Bank", color: "#10b981" },
              { name: "QuickBooks", color: "#34d399" },
            ].map((brand) => (
              <div
                key={brand.name}
                style={{
                  padding: "9px 18px",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: brand.color }}>
                  {brand.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "96px 24px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "rgba(255,255,255,0.01)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#10b981", letterSpacing: "3px", textTransform: "uppercase", marginBottom: 12 }}>
              Pricing
            </p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 50px)", fontWeight: 900, letterSpacing: "-1.5px", margin: "0 0 12px" }}>
              Simple. Fair. No surprises.
            </h2>
            <p style={{ fontSize: 16, color: "#6b7280" }}>Start free. Upgrade when you grow.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 16 }}>
            {/* Starter */}
            <div
              style={{
                background: "#0d0d0d",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 20,
                padding: "36px 32px",
              }}
            >
              <p style={{ fontSize: 12, color: "#4b5563", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10 }}>
                Starter
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: "-2px", color: "#fff" }}>R0</span>
                <span style={{ fontSize: 14, color: "#4b5563", paddingBottom: 12 }}>/month</span>
              </div>
              <p style={{ fontSize: 13, color: "#374151", marginBottom: 32 }}>Get started, no commitment</p>
              {["1 property", "Manual bookings", "Bank import", "P&L report", "Email support"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ color: "#10b981" }}>✓</span>
                  <span style={{ fontSize: 14, color: "#6b7280" }}>{item}</span>
                </div>
              ))}
              <Link
                href="/register"
                style={{
                  display: "block",
                  textAlign: "center",
                  marginTop: 32,
                  padding: "13px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#9ca3af",
                  textDecoration: "none",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div
              style={{
                background: "linear-gradient(160deg,#0a1f16,#0d0d0d)",
                border: "1px solid rgba(16,185,129,0.25)",
                borderRadius: 20,
                padding: "36px 32px",
                position: "relative",
                boxShadow: "0 0 80px rgba(16,185,129,0.07)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -13,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "4px 16px",
                  borderRadius: 100,
                  whiteSpace: "nowrap",
                  letterSpacing: "0.5px",
                }}
              >
                Most popular
              </div>
              <p style={{ fontSize: 12, color: "#10b981", fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 10 }}>
                Pro
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: "-2px", color: "#fff" }}>R499</span>
                <span style={{ fontSize: 14, color: "#4b5563", paddingBottom: 12 }}>/month</span>
              </div>
              <p style={{ fontSize: 13, color: "#374151", marginBottom: 32 }}>Everything, unlimited</p>
              {[
                "Unlimited properties",
                "OTA reconciliation",
                "WhatsApp booking intake",
                "Daily morning digest",
                "Intelligence & RevPAR",
                "Payroll & UIF",
                "Invoices & AI receipts",
                "Cash flow reports",
                "Priority support",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ color: "#10b981" }}>✓</span>
                  <span style={{ fontSize: 14, color: "#d1d5db" }}>{item}</span>
                </div>
              ))}
              <Link
                href="/register"
                style={{
                  display: "block",
                  textAlign: "center",
                  marginTop: 32,
                  padding: "14px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#fff",
                  textDecoration: "none",
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  boxShadow: "0 0 30px rgba(16,185,129,0.3)",
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
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              width: 600,
              height: 400,
              background: "radial-gradient(ellipse, rgba(16,185,129,0.07) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#10b981",
              letterSpacing: "3px",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Let's go
          </p>
          <h2
            style={{
              fontSize: "clamp(32px, 5vw, 60px)",
              fontWeight: 900,
              letterSpacing: "-2px",
              lineHeight: 1.08,
              margin: "0 0 20px",
            }}
          >
            Your numbers deserve{" "}
            <GradientText from="#10b981" to="#38bdf8">
              a better home.
            </GradientText>
          </h2>
          <p style={{ fontSize: 18, color: "#4b5563", marginBottom: 44, lineHeight: 1.6 }}>
            Set up in under 5 minutes. Your first morning digest arrives tomorrow.
          </p>
          <Link
            href="/register"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              fontSize: 17,
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(135deg,#10b981,#059669)",
              padding: "18px 40px",
              borderRadius: 16,
              textDecoration: "none",
              boxShadow: "0 0 60px rgba(16,185,129,0.45), 0 8px 30px rgba(0,0,0,0.5)",
              letterSpacing: "-0.3px",
              position: "relative",
            }}
          >
            Create your free account
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <p style={{ fontSize: 12, color: "#1f2937", marginTop: 18 }}>
            No credit card · No setup fees · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "36px 24px" }}>
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
          <span style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
            Mr<span style={{ color: "#10b981" }}>Money</span>
            <span style={{ fontSize: 12, color: "#1f2937", fontWeight: 400, marginLeft: 8 }}>
              · Hospitality Financial OS
            </span>
          </span>
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/login" style={{ fontSize: 13, color: "#374151", textDecoration: "none" }}>Sign in</Link>
            <Link href="/register" style={{ fontSize: 13, color: "#374151", textDecoration: "none" }}>Register</Link>
            <span style={{ fontSize: 12, color: "#111827" }}>© {new Date().getFullYear()} MrMoney</span>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Visual props for value prop sections ─────────────────────────────────────

function DigestPreview() {
  return (
    <div
      style={{
        background: "#0d1117",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        maxWidth: 300,
        width: "100%",
      }}
    >
      <div style={{ background: "#075e54", padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#25d366", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: 14 }}>M</div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", margin: 0 }}>MrMoney</p>
          <p style={{ fontSize: 9, color: "#b2dfdb", margin: 0 }}>07:00 · daily</p>
        </div>
      </div>
      <div style={{ background: "#0b141a", padding: "14px 12px" }}>
        <div style={{ background: "#202c33", borderRadius: "0 12px 12px 12px", padding: "10px 12px", fontSize: 11, color: "#e9edef", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
{`☀️ Good morning Lebs!
Sunday, 1 March 2026

🏠 GolfBnB
🟩🟩🟩🟩⬜ 6/8 rooms (75%)
📥 Check-ins today: 2
📤 Check-outs today: 1

📊 Revenue MTD: R84,320
💵 Cash position: R12,450
📈 Top channel: Airbnb (42%)

— MrMoney 💚`}
        </div>
      </div>
    </div>
  );
}

function OTAPreview() {
  const rows = [
    { ref: "WKCTzRmz", amount: "R2,100", status: "matched", ota: "Booking.com" },
    { ref: "AIRBNB_3x", amount: "R3,450", status: "matched", ota: "Airbnb" },
    { ref: "LKS-4821", amount: "R1,800", status: "matched", ota: "Lekkerslaap" },
    { ref: "WKCTaB9p", amount: "R2,600", status: "matched", ota: "Booking.com" },
  ];
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, overflow: "hidden", width: "100%", maxWidth: 360, boxShadow: "0 30px 60px rgba(0,0,0,0.5)" }}>
      <div style={{ background: "#111", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", margin: 0 }}>OTA Reconciliation</p>
      </div>
      <div style={{ padding: "8px 0" }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#e5e7eb", margin: "0 0 2px" }}>{r.ref}</p>
              <p style={{ fontSize: 9, color: "#4b5563", margin: 0 }}>{r.ota}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{r.amount}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", padding: "2px 7px", borderRadius: 4 }}>✓ matched</span>
            </div>
          </div>
        ))}
        <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#4b5563" }}>4 payouts · 0 unmatched</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981" }}>All reconciled ✓</span>
        </div>
      </div>
    </div>
  );
}

function SAPreview() {
  const items = [
    { flag: "🇿🇦", label: "ZAR currency", sub: "Native Rand support" },
    { flag: "🏦", label: "Capitec & Standard Bank", sub: "Statement import built in" },
    { flag: "📋", label: "UIF & BCEA compliant", sub: "Payroll by SA law" },
    { flag: "🧾", label: "SARS VAT-ready", sub: "VAT on every transaction" },
    { flag: "🌐", label: "Lekkerslaap", sub: "SA OTA supported" },
  ];
  return (
    <div style={{ background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, overflow: "hidden", width: "100%", maxWidth: 340, boxShadow: "0 30px 60px rgba(0,0,0,0.5)" }}>
      <div style={{ background: "#111", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "12px 16px" }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", margin: 0 }}>Built for South Africa</p>
      </div>
      <div style={{ padding: "6px 0" }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
            <span style={{ fontSize: 20 }}>{item.flag}</span>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#e5e7eb", margin: "0 0 1px" }}>{item.label}</p>
              <p style={{ fontSize: 10, color: "#4b5563", margin: 0 }}>{item.sub}</p>
            </div>
            <span style={{ marginLeft: "auto", color: "#10b981", fontSize: 12 }}>✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
