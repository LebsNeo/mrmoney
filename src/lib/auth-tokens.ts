/**
 * MrMoney — Stateless auth tokens (password reset, email verify)
 * Uses HMAC-SHA256 with NEXTAUTH_SECRET — no DB changes needed.
 */

import { createHmac } from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET ?? "fallback-dev-secret";
const RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function b64(s: string) {
  return Buffer.from(s).toString("base64url");
}
function fromb64(s: string) {
  return Buffer.from(s, "base64url").toString("utf8");
}
function hmac(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

// ─── Password Reset Token ────────────────────

export function signResetToken(email: string): string {
  const expiry = Date.now() + RESET_EXPIRY_MS;
  const payload = `${b64(email)}.${expiry}`;
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

export function verifyResetToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [enc, expiry, sig] = parts;
    const payload = `${enc}.${expiry}`;
    if (hmac(payload) !== sig) return null;
    if (Date.now() > parseInt(expiry, 10)) return null;
    return fromb64(enc); // returns email
  } catch {
    return null;
  }
}
