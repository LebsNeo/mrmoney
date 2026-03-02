/**
 * MrCA — Premium Email Templates
 * Dark-themed, brand-consistent HTML emails via Resend.
 */

export function verifyEmailTemplate(opts: {
  name: string;
  verifyUrl: string;
  expiryHours?: number;
}): { subject: string; html: string; text: string } {
  const { name, verifyUrl, expiryHours = 72 } = opts;
  const firstName = name.split(" ")[0];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your MrCA account</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0a0a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:560px;background:#111111;border:1px solid #1f1f1f;border-radius:20px;overflow:hidden;">

          <!-- Top accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#10b981 0%,#059669 50%,#0ea5e9 100%);"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:40px 48px 32px;text-align:center;">
              <!-- Logo wordmark -->
              <div style="margin-bottom:28px;">
                <span style="font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">
                  Mr<span style="color:#10b981;">Money</span>
                </span>
                <div style="margin-top:4px;font-size:11px;letter-spacing:2px;color:#4b5563;text-transform:uppercase;font-weight:500;">
                  Hospitality Financial OS
                </div>
              </div>

              <!-- Icon circle -->
              <div style="display:inline-block;width:64px;height:64px;background:#10b981;border-radius:50%;margin-bottom:24px;line-height:64px;text-align:center;font-size:28px;">
                ✉
              </div>

              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">
                Verify your email address
              </h1>
              <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.5;">
                Hi ${firstName}, welcome to MrCA. One last step before you start.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background:#1f1f1f;"></div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 48px;">
              <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;line-height:1.7;">
                You're almost in. Click the button below to verify your email address and activate your MrCA account.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${verifyUrl}"
                      style="display:inline-block;padding:16px 40px;background:#10b981;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;letter-spacing:0.2px;">
                      Verify Email Address →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- What you get section -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                style="background:#0f1f18;border:1px solid #1a3028;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 14px;font-size:12px;font-weight:600;color:#10b981;letter-spacing:1.5px;text-transform:uppercase;">
                      What you get with MrCA
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      ${[
                        ["📊", "Real-time revenue & cash position"],
                        ["🏨", "Occupancy, ADR & RevPAR tracking"],
                        ["🔄", "OTA reconciliation — Booking.com, Airbnb, Lekkerslaap"],
                        ["💰", "Payroll, invoices & expense capture"],
                        ["📈", "Channel mix & 6-month trend intelligence"],
                      ].map(([icon, text]) => `
                      <tr>
                        <td style="padding:5px 0;">
                          <span style="font-size:14px;margin-right:10px;">${icon}</span>
                          <span style="font-size:13px;color:#d1d5db;">${text}</span>
                        </td>
                      </tr>`).join("")}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- URL fallback -->
              <p style="margin:0 0 6px;font-size:12px;color:#4b5563;">
                Button not working? Copy and paste this link into your browser:
              </p>
              <p style="margin:0;font-size:11px;color:#374151;word-break:break-all;font-family:monospace;background:#0d0d0d;border:1px solid #1f1f1f;border-radius:8px;padding:10px 12px;">
                ${verifyUrl}
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 48px;">
              <div style="height:1px;background:#1f1f1f;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 48px 36px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#4b5563;line-height:1.6;">
                This link expires in <strong style="color:#6b7280;">${expiryHours} hours</strong>.
                If you didn't create a MrCA account, you can safely ignore this email.
              </p>
              <p style="margin:16px 0 0;font-size:11px;color:#374151;">
                © ${new Date().getFullYear()} MrCA · Hospitality Financial OS
              </p>
            </td>
          </tr>

        </table>
        <!-- End card -->

      </td>
    </tr>
  </table>

</body>
</html>`;

  const text = `
MrCA — Verify your email address

Hi ${firstName},

Welcome to MrCA. Please verify your email address to activate your account.

Verify here: ${verifyUrl}

This link expires in ${expiryHours} hours.

If you didn't create a MrCA account, ignore this email.

— The MrCA Team
`.trim();

  return {
    subject: "Verify your MrCA account",
    html,
    text,
  };
}


export function welcomeEmailTemplate(opts: {
  name: string;
  dashboardUrl: string;
}): { subject: string; html: string; text: string } {
  const { name, dashboardUrl } = opts;
  const firstName = name.split(" ")[0];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to MrCA</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a0a0a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="max-width:560px;background:#111111;border:1px solid #1f1f1f;border-radius:20px;overflow:hidden;">

          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#10b981 0%,#059669 50%,#0ea5e9 100%);"></td>
          </tr>

          <tr>
            <td style="padding:40px 48px 24px;text-align:center;">
              <div style="margin-bottom:24px;">
                <span style="font-size:28px;font-weight:800;color:#ffffff;">
                  Mr<span style="color:#10b981;">Money</span>
                </span>
              </div>
              <div style="font-size:40px;margin-bottom:20px;">🎉</div>
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;">
                You're in, ${firstName}!
              </h1>
              <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.5;">
                Your account is verified and your financial OS is ready.
              </p>
            </td>
          </tr>

          <tr><td style="padding:0 48px;"><div style="height:1px;background:#1f1f1f;"></div></td></tr>

          <tr>
            <td style="padding:32px 48px;">
              <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;line-height:1.7;">
                Start by setting up your property, adding your rooms, and importing your first bank statement. MrCA will take care of the rest.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="${dashboardUrl}"
                      style="display:inline-block;padding:16px 40px;background:#10b981;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:12px;">
                      Go to Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="padding:0 48px;"><div style="height:1px;background:#1f1f1f;"></div></td></tr>

          <tr>
            <td style="padding:24px 48px 36px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#374151;">
                © ${new Date().getFullYear()} MrCA · Hospitality Financial OS
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: `Welcome to MrCA, ${firstName}! 🎉`,
    html,
    text: `Welcome to MrCA, ${firstName}!\n\nYour account is verified. Go to your dashboard: ${dashboardUrl}`,
  };
}


// ─── Shared Resend sender ─────────────────────────────────────────────────────

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — email not sent");
    return { ok: false, error: "Email service not configured" };
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "MrCA <noreply@mrmoney.app>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("Resend error:", body);
    return { ok: false, error: "Failed to send email" };
  }

  return { ok: true };
}
