import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — POPIA Compliant | MrCA",
  description: "MrCA's privacy policy — compliant with the Protection of Personal Information Act (POPIA) of South Africa.",
};

const LAST_UPDATED = "14 March 2026";
const COMPANY = "MrCA (Pty) Ltd";
const CONTACT_EMAIL = "privacy@mrca.co.za";
const SUPPORT_EMAIL = "support@mrca.co.za";
const WEBSITE = "www.mrca.co.za";

export default function PrivacyPage() {
  return (
    <div style={{ background: "#030712", minHeight: "100vh" }}>
      {/* Nav */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontSize: 18, fontWeight: 800, color: "#fff", textDecoration: "none" }}>
            Mr<span style={{ color: "#10b981" }}>CA</span>
          </Link>
          <Link href="/login" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>Sign In</Link>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 96px", color: "#d1d5db", fontSize: 15, lineHeight: 1.8 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-1px", marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 40 }}>Last updated: {LAST_UPDATED}</p>

        <Section n="1" title="Introduction and Responsible Party">
          <p>
            {COMPANY} (&ldquo;MrCA&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates the hospitality
            financial management platform at <A href={`https://${WEBSITE}`}>{WEBSITE}</A>. We are the responsible party
            as defined in the Protection of Personal Information Act, 2013 (POPIA) for the personal information we process.
          </p>
          <InfoBox>
            <strong style={{ color: "#fff" }}>Information Officer</strong><br />
            Email: <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A><br />
            Website: <A href={`https://${WEBSITE}`}>{WEBSITE}</A>
          </InfoBox>
        </Section>

        <Section n="2" title="Definitions">
          <ul>
            <li><strong style={{ color: "#e5e7eb" }}>Operator (You)</strong> — A hospitality business (guesthouse, lodge, hotel, B&amp;B) that uses MrCA to manage operations.</li>
            <li><strong style={{ color: "#e5e7eb" }}>Guest</strong> — A person whose booking, contact, or payment information is processed through MrCA on behalf of an Operator.</li>
            <li><strong style={{ color: "#e5e7eb" }}>User</strong> — Any person who creates an account on MrCA (owners, managers, accountants, staff).</li>
            <li><strong style={{ color: "#e5e7eb" }}>Personal Information</strong> — As defined in POPIA Section 1 — any information relating to an identifiable, living natural person or juristic person.</li>
          </ul>
        </Section>

        <Section n="3" title="Personal Information We Collect">
          <H3>3.1 Account Information (Users)</H3>
          <ul>
            <li>Full name, email address, password (hashed)</li>
            <li>Role within the organisation (Owner, Manager, Accountant, Staff)</li>
            <li>Telegram chat ID and WhatsApp number (if linked)</li>
          </ul>

          <H3>3.2 Organisation &amp; Property Information</H3>
          <ul>
            <li>Business name, VAT number, physical address</li>
            <li>Property details (rooms, rates, banking information for invoices)</li>
          </ul>

          <H3>3.3 Guest Information (processed on behalf of the Operator)</H3>
          <ul>
            <li>Guest name, email address, phone number</li>
            <li>Booking dates, room allocation, booking source</li>
            <li>Payment amounts and proof of payment images</li>
          </ul>

          <H3>3.4 Financial Data</H3>
          <ul>
            <li>Bank statements uploaded for reconciliation (FNB, ABSA, Nedbank, Standard Bank, Capitec)</li>
            <li>Transaction records, invoices, receipts</li>
            <li>OTA payout data (Booking.com, Airbnb, Lekkerslaap)</li>
            <li>Payroll data (employee salaries, UIF, PAYE, advances)</li>
          </ul>

          <H3>3.5 Communication Data</H3>
          <ul>
            <li>WhatsApp messages exchanged via the WhatsApp Business API for booking intake</li>
            <li>Telegram messages exchanged with the MrCA staff bot</li>
          </ul>

          <H3>3.6 Technical Data</H3>
          <ul>
            <li>IP address, browser type, device information</li>
            <li>Usage logs and error reports</li>
          </ul>
        </Section>

        <Section n="4" title="Lawful Basis for Processing (POPIA Section 11)">
          <p>We process personal information under the following lawful grounds:</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1f1f1f" }}>
                <th style={{ textAlign: "left", padding: "10px 0", color: "#9ca3af", fontWeight: 600 }}>Purpose</th>
                <th style={{ textAlign: "left", padding: "10px 0", color: "#9ca3af", fontWeight: 600 }}>Lawful Basis</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Providing the MrCA platform", "Contract (Section 11(1)(b))"],
                ["Processing guest bookings", "Legitimate interest of the Operator (Section 11(1)(f))"],
                ["Sending booking confirmations", "Contract / Legitimate interest"],
                ["Financial reporting & VAT compliance", "Legal obligation (Section 11(1)(c))"],
                ["Sending payslips to employees", "Legal obligation (BCEA Section 32)"],
                ["WhatsApp & Telegram messaging", "Consent (Section 11(1)(a))"],
                ["Improving the platform", "Legitimate interest (Section 11(1)(f))"],
                ["Security & fraud prevention", "Legitimate interest"],
              ].map(([purpose, basis], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #111" }}>
                  <td style={{ padding: "8px 8px 8px 0", color: "#d1d5db" }}>{purpose}</td>
                  <td style={{ padding: "8px 0", color: "#9ca3af" }}>{basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section n="5" title="Guest Data — Operator Responsibility">
          <InfoBox>
            <strong style={{ color: "#f59e0b" }}>Important for Operators:</strong> When you use MrCA to process guest
            personal information (names, emails, phone numbers, payment details), <strong style={{ color: "#fff" }}>you</strong> are
            the responsible party under POPIA, and MrCA acts as your <strong style={{ color: "#fff" }}>operator</strong> (processor).
          </InfoBox>
          <p>This means:</p>
          <ul>
            <li>You must have a lawful basis for collecting guest data (typically contract or legitimate interest)</li>
            <li>You are responsible for informing guests about how their data is used</li>
            <li>You must respond to guest data access, correction, or deletion requests</li>
            <li>MrCA will process guest data only on your instructions and for the purposes of providing the platform</li>
          </ul>
          <p>
            We will assist you in fulfilling your POPIA obligations. Contact us at <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A> for
            data subject requests related to guest information.
          </p>
        </Section>

        <Section n="6" title="How We Use Your Information">
          <ul>
            <li>To provide, maintain, and improve the MrCA platform</li>
            <li>To process bookings, generate invoices, and reconcile transactions</li>
            <li>To send booking confirmations and reservation notifications to guests via email</li>
            <li>To send daily digest messages, payslips, and operational alerts via WhatsApp and Telegram</li>
            <li>To calculate payroll, PAYE, and UIF contributions</li>
            <li>To generate financial reports (P&amp;L, cash flow, KPIs, budget vs actual)</li>
            <li>To import and reconcile bank statements and OTA payouts</li>
            <li>To respond to support requests</li>
          </ul>
        </Section>

        <Section n="7" title="Third-Party Service Providers">
          <p>We share personal information with the following processors, all bound by data processing agreements:</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1f1f1f" }}>
                <th style={{ textAlign: "left", padding: "10px 0", color: "#9ca3af", fontWeight: 600 }}>Provider</th>
                <th style={{ textAlign: "left", padding: "10px 0", color: "#9ca3af", fontWeight: 600 }}>Purpose</th>
                <th style={{ textAlign: "left", padding: "10px 0", color: "#9ca3af", fontWeight: 600 }}>Location</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Neon (PostgreSQL)", "Database hosting", "EU (AWS eu-west-2)"],
                ["Vercel", "Application hosting & CDN", "Global (edge)"],
                ["Meta (WhatsApp Business API)", "WhatsApp messaging", "Global"],
                ["Telegram", "Staff bot messaging", "Global"],
                ["Resend", "Transactional email delivery", "US"],
                ["OpenAI", "AI-powered booking intake & categorisation", "US"],
                ["Vercel Blob", "File storage (receipts, proof of payment)", "Global"],
              ].map(([provider, purpose, location], i) => (
                <tr key={i} style={{ borderBottom: "1px solid #111" }}>
                  <td style={{ padding: "8px 8px 8px 0", color: "#d1d5db" }}>{provider}</td>
                  <td style={{ padding: "8px 0", color: "#9ca3af" }}>{purpose}</td>
                  <td style={{ padding: "8px 0", color: "#6b7280" }}>{location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section n="8" title="Cross-Border Data Transfers (POPIA Section 72)">
          <p>
            Some of our service providers operate outside South Africa. We ensure that cross-border transfers
            comply with POPIA Section 72 by verifying that recipient countries have adequate data protection
            laws or that appropriate contractual safeguards are in place.
          </p>
          <p>
            Your database is hosted on Neon in the EU (AWS eu-west-2, London), which is subject to GDPR —
            a data protection framework recognised as adequate.
          </p>
        </Section>

        <Section n="9" title="Data Security">
          <p>We implement appropriate technical and organisational measures to protect your information:</p>
          <ul>
            <li>All data transmitted over HTTPS (TLS 1.3)</li>
            <li>Passwords hashed with bcryptjs (12 rounds)</li>
            <li>Authentication via signed JWT tokens (HMAC-SHA256)</li>
            <li>Finance section protected by PIN with signed access tokens</li>
            <li>Rate limiting on authentication endpoints</li>
            <li>Security headers (CSP, X-Frame-Options, HSTS)</li>
            <li>Soft deletes throughout — no data is permanently destroyed without request</li>
            <li>Role-based access control (Owner, Manager, Accountant, Staff)</li>
          </ul>
        </Section>

        <Section n="10" title="Data Retention">
          <p>We retain personal information for as long as:</p>
          <ul>
            <li>Your account is active</li>
            <li>Required to provide the service</li>
            <li>Required by South African tax law (financial records: 5 years per the Tax Administration Act)</li>
            <li>Required for BCEA compliance (payroll records: 3 years after employment ends)</li>
          </ul>
          <p>
            When you close your account, we will delete or anonymise your personal information within 30 days,
            except where retention is required by law.
          </p>
        </Section>

        <Section n="11" title="Your Rights Under POPIA">
          <p>As a data subject, you have the right to:</p>
          <ul>
            <li><strong style={{ color: "#e5e7eb" }}>Access</strong> — Request a copy of the personal information we hold about you</li>
            <li><strong style={{ color: "#e5e7eb" }}>Correction</strong> — Request correction of inaccurate or incomplete information</li>
            <li><strong style={{ color: "#e5e7eb" }}>Deletion</strong> — Request deletion of your personal information (subject to legal retention requirements)</li>
            <li><strong style={{ color: "#e5e7eb" }}>Objection</strong> — Object to the processing of your personal information on grounds of legitimate interest</li>
            <li><strong style={{ color: "#e5e7eb" }}>Restriction</strong> — Request restriction of processing in certain circumstances</li>
            <li><strong style={{ color: "#e5e7eb" }}>Data portability</strong> — Request your data in a machine-readable format (CSV export is available within the platform)</li>
            <li><strong style={{ color: "#e5e7eb" }}>Withdraw consent</strong> — Where processing is based on consent, you may withdraw it at any time</li>
          </ul>
          <p>
            To exercise any of these rights, email us at <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A>.
            We will respond within 30 days as required by POPIA.
          </p>
        </Section>

        <Section n="12" title="WhatsApp &amp; Telegram Messaging">
          <p>
            MrCA uses the WhatsApp Business API (via Meta) and Telegram Bot API to send and receive messages
            on behalf of Operators. By opting in to these integrations:
          </p>
          <ul>
            <li>You consent to messages being processed through Meta&apos;s and Telegram&apos;s infrastructure</li>
            <li>Message content may be processed by AI (OpenAI) for booking extraction and natural language understanding</li>
            <li>You can opt out at any time by unlinking your account in Settings</li>
            <li>Employee payslip delivery via WhatsApp/Telegram requires explicit employee opt-in</li>
          </ul>
        </Section>

        <Section n="13" title="Cookies &amp; Tracking">
          <p>
            MrCA uses only essential cookies required for authentication and session management.
            We do not use advertising cookies, tracking pixels, or third-party analytics.
            No cookie consent banner is required as we only use strictly necessary cookies.
          </p>
        </Section>

        <Section n="14" title="Children&rsquo;s Information">
          <p>
            MrCA is a business-to-business platform and is not intended for use by persons under 18.
            We do not knowingly collect personal information from children. If we become aware that we have
            collected information from a child, we will delete it promptly.
          </p>
        </Section>

        <Section n="15" title="Data Breach Notification">
          <p>
            In the event of a data breach that may compromise your personal information, we will:
          </p>
          <ul>
            <li>Notify the Information Regulator as required by POPIA Section 22</li>
            <li>Notify affected data subjects as soon as reasonably possible</li>
            <li>Take immediate steps to contain and remediate the breach</li>
            <li>Document the breach and our response measures</li>
          </ul>
        </Section>

        <Section n="16" title="Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Material changes will be communicated
            via email or in-app notification. Continued use of MrCA after changes constitutes acceptance
            of the updated policy.
          </p>
        </Section>

        <Section n="17" title="Complaints &amp; the Information Regulator">
          <p>
            If you are not satisfied with how we handle your personal information, you have the right
            to lodge a complaint with the South African Information Regulator:
          </p>
          <InfoBox>
            <strong style={{ color: "#fff" }}>Information Regulator (South Africa)</strong><br />
            Email: complaints.IR@justice.gov.za<br />
            Tel: 012 406 4818<br />
            Website: <A href="https://inforegulator.org.za">inforegulator.org.za</A>
          </InfoBox>
        </Section>

        <Section n="18" title="Contact Us">
          <p>For any questions about this Privacy Policy or your personal information:</p>
          <InfoBox>
            <strong style={{ color: "#fff" }}>{COMPANY}</strong><br />
            Information Officer: <A href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</A><br />
            Support: <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A><br />
            Website: <A href={`https://${WEBSITE}`}>{WEBSITE}</A>
          </InfoBox>
        </Section>
      </main>
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 12 }}>
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e5e7eb", margin: "16px 0 8px" }}>{children}</h3>;
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} style={{ color: "#10b981", textDecoration: "none" }} target="_blank" rel="noopener noreferrer">{children}</a>;
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#0a0a0a",
      border: "1px solid #1f1f1f",
      borderRadius: 12,
      padding: "16px 20px",
      margin: "16px 0",
      fontSize: 14,
      lineHeight: 1.8,
      color: "#9ca3af",
    }}>
      {children}
    </div>
  );
}
