export const metadata = {
  title: "Privacy Policy | MrCA",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: March 2026</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
        <p>MrCA (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is a financial management platform built for South African hospitality businesses. This Privacy Policy explains how we collect, use, and protect your information when you use our services at <a href="https://www.mrca.co.za" className="text-blue-600 underline">www.mrca.co.za</a>.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Account information (name, email address, business details)</li>
          <li>Financial data you upload or enter (bank statements, transactions)</li>
          <li>Booking and property data</li>
          <li>WhatsApp messages sent to or received from your MrCA business number</li>
          <li>Usage data and logs</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>To provide and improve the MrCA platform</li>
          <li>To send financial reports, invoices, and notifications</li>
          <li>To process bookings and reconcile transactions</li>
          <li>To communicate with you about your account</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. WhatsApp Messaging</h2>
        <p>MrCA uses the WhatsApp Business API (via Meta) to send and receive messages on your behalf. By using our WhatsApp integration, you consent to messages being processed through Meta&rsquo;s infrastructure. We do not share your WhatsApp data with third parties beyond what is required to deliver the service.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
        <p>We use industry-standard encryption and security practices to protect your data. All data is stored on secure cloud infrastructure (Vercel + Neon PostgreSQL) with access controls and audit logging.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
        <p>We retain your data for as long as your account is active or as required by law. You may request deletion of your account and data by contacting us at <a href="mailto:support@mrca.co.za" className="text-blue-600 underline">support@mrca.co.za</a>.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
        <p>You have the right to access, correct, or delete your personal data. To exercise these rights, contact us at <a href="mailto:support@mrca.co.za" className="text-blue-600 underline">support@mrca.co.za</a>.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">8. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us at:</p>
        <p className="mt-2"><strong>MrCA</strong><br />Email: <a href="mailto:support@mrca.co.za" className="text-blue-600 underline">support@mrca.co.za</a><br />Website: <a href="https://www.mrca.co.za" className="text-blue-600 underline">www.mrca.co.za</a></p>
      </section>
    </main>
  );
}
