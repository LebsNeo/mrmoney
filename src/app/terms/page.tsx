import Link from "next/link";

export const metadata = {
  title: "Terms of Service | MrCA",
  description: "MrCA Terms of Service — governing use of the hospitality financial management platform.",
};

const LAST_UPDATED = "15 March 2026";
const COMPANY = "MrCA (Pty) Ltd";
const SUPPORT_EMAIL = "support@mrca.co.za";
const LEGAL_EMAIL = "legal@mrca.co.za";
const WEBSITE = "www.mrca.co.za";

export default function TermsPage() {
  return (
    <div style={{ background: "#030712", minHeight: "100vh" }}>
      {/* Nav */}
      <header style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontSize: 18, fontWeight: 800, color: "#fff", textDecoration: "none" }}>
            Mr<span style={{ color: "#10b981" }}>CA</span>
          </Link>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link href="/privacy" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>Privacy</Link>
            <Link href="/login" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>Sign In</Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 96px", color: "#d1d5db", fontSize: 15, lineHeight: 1.8 }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-1px", marginBottom: 8 }}>Terms of Service</h1>
        <p style={{ fontSize: 13, color: "#4b5563", marginBottom: 40 }}>Last updated: {LAST_UPDATED}</p>

        <Section n="1" title="Agreement to Terms">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you
            (&ldquo;Operator&rdquo;, &ldquo;you&rdquo;, or &ldquo;your&rdquo;) and {COMPANY} (&ldquo;MrCA&rdquo;,
            &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) governing your use of the MrCA platform
            at <A href={`https://${WEBSITE}`}>{WEBSITE}</A>, including all related services, features, and applications.
          </p>
          <p>
            By creating an account or using MrCA, you agree to these Terms. If you do not agree, do not use the platform.
          </p>
        </Section>

        <Section n="2" title="Definitions">
          <ul>
            <li><strong style={{ color: "#e5e7eb" }}>Platform</strong> — The MrCA web application, APIs, Telegram bot, WhatsApp integrations, and all related services.</li>
            <li><strong style={{ color: "#e5e7eb" }}>Operator</strong> — A hospitality business or individual that registers for and uses MrCA.</li>
            <li><strong style={{ color: "#e5e7eb" }}>User</strong> — Any person with an account on MrCA, including Owners, Managers, Accountants, and Staff.</li>
            <li><strong style={{ color: "#e5e7eb" }}>Guest Data</strong> — Personal information of guests processed through MrCA on behalf of the Operator.</li>
            <li><strong style={{ color: "#e5e7eb" }}>Organisation</strong> — The business entity created on MrCA, to which Users and Properties belong.</li>
          </ul>
        </Section>

        <Section n="3" title="Eligibility">
          <p>To use MrCA, you must:</p>
          <ul>
            <li>Be at least 18 years of age</li>
            <li>Have the legal authority to bind your business to these Terms</li>
            <li>Provide accurate and complete registration information</li>
            <li>Be a South African registered business or operate a hospitality property in South Africa</li>
          </ul>
        </Section>

        <Section n="4" title="Account Registration &amp; Security">
          <p>When you create an account:</p>
          <ul>
            <li>You must provide a valid email address and verify it within 72 hours</li>
            <li>You are responsible for maintaining the confidentiality of your password</li>
            <li>You must not share your account credentials with unauthorised persons</li>
            <li>You must notify us immediately of any unauthorised use of your account</li>
            <li>The Owner role has full administrative access and can invite team members with specific roles (Manager, Accountant, Staff)</li>
          </ul>
          <p>
            We reserve the right to suspend or terminate accounts that violate these Terms or pose a security risk.
          </p>
        </Section>

        <Section n="5" title="Subscription Plans &amp; Pricing">
          <H3>5.1 Plans</H3>
          <p>MrCA offers the following subscription plans:</p>
          <ul>
            <li><strong style={{ color: "#e5e7eb" }}>Starter (Free)</strong> — 1 property, manual bookings, basic reporting</li>
            <li><strong style={{ color: "#e5e7eb" }}>Pro (R299/month)</strong> — Unlimited properties, OTA reconciliation, WhatsApp booking intake, daily digest, payroll, KPIs, full reporting</li>
          </ul>

          <H3>5.2 Free Trial</H3>
          <p>
            New accounts receive a 3-month free trial of the Pro plan. No credit card is required to start.
            After the trial period, your account will revert to the Starter plan unless you subscribe.
          </p>

          <H3>5.3 Billing</H3>
          <ul>
            <li>Subscription fees are billed monthly in South African Rand (ZAR)</li>
            <li>All prices are inclusive of VAT where applicable</li>
            <li>We reserve the right to change pricing with 30 days&apos; written notice</li>
            <li>No refunds are provided for partial months of service</li>
          </ul>
        </Section>

        <Section n="6" title="Acceptable Use">
          <p>You agree not to:</p>
          <ul>
            <li>Use MrCA for any unlawful purpose or in violation of any applicable laws</li>
            <li>Upload malicious code, viruses, or harmful content</li>
            <li>Attempt to gain unauthorised access to other users&apos; accounts or data</li>
            <li>Use the platform to store or transmit content that infringes intellectual property rights</li>
            <li>Reverse-engineer, decompile, or attempt to extract the source code of MrCA</li>
            <li>Use automated tools (bots, scrapers) to access the platform without our written consent</li>
            <li>Resell or redistribute access to MrCA without authorisation</li>
            <li>Process personal information in violation of POPIA or any applicable data protection law</li>
          </ul>
        </Section>

        <Section n="7" title="Data Ownership &amp; Responsibility">
          <H3>7.1 Your Data</H3>
          <p>
            You retain all ownership rights to the data you upload, enter, or generate through MrCA,
            including financial records, booking data, employee information, and guest data.
          </p>

          <H3>7.2 Guest Data Responsibility</H3>
          <InfoBox>
            As the Operator, you are the responsible party under POPIA for all Guest Data processed through MrCA.
            MrCA acts as your operator (processor). You are responsible for obtaining appropriate consent and
            providing privacy notices to your guests.
          </InfoBox>

          <H3>7.3 Data Export</H3>
          <p>
            You may export your data at any time using the CSV export functionality available throughout the platform.
            Upon account termination, we will make your data available for export for 30 days.
          </p>

          <H3>7.4 Our Use of Your Data</H3>
          <p>
            We will only access your data to provide and improve the platform, respond to support requests,
            or as required by law. We will never sell your data to third parties. See our{" "}
            <A href="/privacy">Privacy Policy</A> for full details.
          </p>
        </Section>

        <Section n="8" title="Financial Data &amp; Accuracy">
          <InfoBox>
            <strong style={{ color: "#f59e0b" }}>Important:</strong> MrCA is a financial management tool, not a licensed
            financial services provider. The platform assists with bookkeeping, reporting, and reconciliation, but
            does not constitute financial, tax, or legal advice.
          </InfoBox>
          <ul>
            <li>You are responsible for verifying the accuracy of all financial data, reports, and calculations</li>
            <li>PAYE calculations are based on SARS 2025/2026 tax tables and may require manual verification</li>
            <li>UIF calculations follow current SARS guidelines but should be confirmed with your accountant</li>
            <li>Bank statement imports and OTA reconciliation are automated tools — always verify matched transactions</li>
            <li>MrCA is not a substitute for professional accounting or tax advice</li>
          </ul>
        </Section>

        <Section n="9" title="Payroll &amp; Employment">
          <p>
            MrCA provides payroll processing tools including PAYE, UIF, and payslip generation.
            As the employer, you remain responsible for:
          </p>
          <ul>
            <li>Compliance with the Basic Conditions of Employment Act (BCEA)</li>
            <li>Accurate employee records and employment contracts</li>
            <li>Timely payment of SARS obligations (PAYE, UIF, SDL)</li>
            <li>Issuing IRP5 certificates (not currently generated by MrCA)</li>
            <li>Minimum wage compliance per the National Minimum Wage Act</li>
          </ul>
        </Section>

        <Section n="10" title="Stokvel Management">
          <p>
            MrCA provides tools for managing employee stokvels (savings groups). As the stokvel administrator:
          </p>
          <ul>
            <li>You are responsible for ensuring stokvel rules are communicated to members</li>
            <li>Auto-deduction from payroll requires member awareness (contributions are visible on payslips)</li>
            <li>MrCA does not hold stokvel funds — balance tracking is informational only</li>
            <li>Payout decisions and distribution are the responsibility of the stokvel administrator</li>
          </ul>
        </Section>

        <Section n="11" title="WhatsApp &amp; Telegram Integration">
          <ul>
            <li>WhatsApp messaging operates through the Meta WhatsApp Business API and is subject to Meta&apos;s terms</li>
            <li>Telegram messaging operates through the Telegram Bot API and is subject to Telegram&apos;s terms</li>
            <li>Message delivery is best-effort — we do not guarantee delivery of messages</li>
            <li>AI-powered booking extraction uses OpenAI and is subject to OpenAI&apos;s usage policies</li>
            <li>You are responsible for the content of messages sent from your MrCA-connected accounts</li>
          </ul>
        </Section>

        <Section n="12" title="Intellectual Property">
          <p>
            MrCA, including its code, design, logos, documentation, and branding, is the intellectual property
            of {COMPANY}. You may not copy, modify, or distribute any part of the platform without our written consent.
          </p>
          <p>
            White-labelled emails (booking confirmations, payslips) sent on your behalf may include a
            &ldquo;Powered by MrCA&rdquo; attribution.
          </p>
        </Section>

        <Section n="13" title="Service Availability &amp; Support">
          <ul>
            <li>We aim for 99.9% uptime but do not guarantee uninterrupted service</li>
            <li>Scheduled maintenance will be communicated in advance where possible</li>
            <li>Support is provided via email at <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A></li>
            <li>We are not liable for downtime caused by third-party providers (Vercel, Neon, Meta, Telegram, Resend)</li>
          </ul>
        </Section>

        <Section n="14" title="Limitation of Liability">
          <p>To the maximum extent permitted by South African law:</p>
          <ul>
            <li>MrCA is provided &ldquo;as is&rdquo; without warranties of any kind, express or implied</li>
            <li>We are not liable for any indirect, incidental, special, consequential, or punitive damages</li>
            <li>Our total liability for any claim shall not exceed the fees paid by you in the 12 months preceding the claim</li>
            <li>We are not liable for losses arising from inaccurate financial data, incorrect tax calculations, or missed deadlines</li>
            <li>We are not liable for data loss caused by your actions or third-party service failures</li>
          </ul>
        </Section>

        <Section n="15" title="Indemnification">
          <p>
            You agree to indemnify and hold harmless {COMPANY}, its directors, employees, and agents from any claims,
            damages, losses, or expenses (including legal fees) arising from:
          </p>
          <ul>
            <li>Your use of the platform in violation of these Terms</li>
            <li>Your violation of any applicable law, including POPIA</li>
            <li>Any claim by a third party (including guests or employees) related to data you processed through MrCA</li>
          </ul>
        </Section>

        <Section n="16" title="Termination">
          <H3>16.1 By You</H3>
          <p>
            You may stop using MrCA at any time. To close your account, contact us at{" "}
            <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A>. Your data will be available for export
            for 30 days after account closure.
          </p>

          <H3>16.2 By Us</H3>
          <p>We may suspend or terminate your account if:</p>
          <ul>
            <li>You violate these Terms</li>
            <li>Your account poses a security risk</li>
            <li>You fail to pay subscription fees after the trial period (with 14 days&apos; notice)</li>
            <li>Required by law or court order</li>
          </ul>
        </Section>

        <Section n="17" title="Changes to Terms">
          <p>
            We may update these Terms from time to time. Material changes will be communicated via email
            or in-app notification at least 30 days before they take effect. Continued use of MrCA after
            the effective date constitutes acceptance of the updated Terms.
          </p>
        </Section>

        <Section n="18" title="Governing Law &amp; Disputes">
          <p>
            These Terms are governed by the laws of the Republic of South Africa. Any disputes arising
            from or relating to these Terms shall be resolved in the courts of South Africa, with
            jurisdiction in the Gauteng Division of the High Court.
          </p>
          <p>
            Before initiating legal proceedings, both parties agree to attempt resolution through
            good-faith negotiation for a period of 30 days.
          </p>
        </Section>

        <Section n="19" title="Severability">
          <p>
            If any provision of these Terms is found to be unenforceable, the remaining provisions
            shall continue in full force and effect.
          </p>
        </Section>

        <Section n="20" title="Contact">
          <p>For questions about these Terms:</p>
          <InfoBox>
            <strong style={{ color: "#fff" }}>{COMPANY}</strong><br />
            Legal: <A href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</A><br />
            Support: <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A><br />
            Website: <A href={`https://${WEBSITE}`}>{WEBSITE}</A>
          </InfoBox>
        </Section>

        {/* Cross-links */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid #1f1f1f", display: "flex", gap: 24, fontSize: 13 }}>
          <A href="/privacy">Privacy Policy</A>
          <A href="/terms">Terms of Service</A>
          <A href="/">Home</A>
        </div>
      </main>
    </div>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 12 }}>{n}. {title}</h2>
      {children}
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 15, fontWeight: 600, color: "#e5e7eb", margin: "16px 0 8px" }}>{children}</h3>;
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} style={{ color: "#10b981", textDecoration: "none" }}>{children}</a>;
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "#0a0a0a", border: "1px solid #1f1f1f", borderRadius: 12,
      padding: "16px 20px", margin: "16px 0", fontSize: 14, lineHeight: 1.8, color: "#9ca3af",
    }}>
      {children}
    </div>
  );
}
