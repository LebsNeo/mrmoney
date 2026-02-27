import { createHmac } from "crypto";

/**
 * Creates a URL-safe signed token for public invoice access.
 * Token = base64url(invoiceId) + "." + HMAC(invoiceId, secret)
 * No expiry — token is valid as long as the secret doesn't change.
 */
export function signInvoiceToken(invoiceId: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? "mrmoney-fallback-secret";
  const hmac = createHmac("sha256", secret).update(invoiceId).digest("base64url");
  const id64 = Buffer.from(invoiceId).toString("base64url");
  return `${id64}.${hmac}`;
}

/**
 * Verifies the token and returns the invoiceId, or null if invalid.
 */
export function verifyInvoiceToken(token: string): string | null {
  try {
    const [id64, sig] = token.split(".");
    if (!id64 || !sig) return null;
    const invoiceId = Buffer.from(id64, "base64url").toString("utf-8");
    const expected = signInvoiceToken(invoiceId);
    // Constant-time comparison
    if (token !== expected) return null;
    return invoiceId;
  } catch {
    return null;
  }
}
