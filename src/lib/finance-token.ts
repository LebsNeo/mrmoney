/**
 * Lightweight HMAC token for finance unlock cookie.
 * Not a JWT — just orgId + expiry + signature.
 */
import { createHmac } from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET ?? "mrca-finance-secret";

export function sign(orgId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 8; // 8h
  const payload = `${orgId}.${exp}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex").substring(0, 16);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verify(token: string, orgId?: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const parts = decoded.split(".");
    if (parts.length !== 3) return false;
    const [tokenOrgId, expStr, sig] = parts;
    // Only check orgId match if provided
    if (orgId && tokenOrgId !== orgId) return false;
    const exp = parseInt(expStr, 10);
    if (Date.now() / 1000 > exp) return false;
    const payload = `${tokenOrgId}.${expStr}`;
    const expected = createHmac("sha256", SECRET).update(payload).digest("hex").substring(0, 16);
    return sig === expected;
  } catch {
    return false;
  }
}
