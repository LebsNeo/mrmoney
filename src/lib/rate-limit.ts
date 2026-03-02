/**
 * MrCA — In-Memory Rate Limiter
 * Phase 9: Simple sliding window rate limiter — no Redis needed.
 *
 * Note: State is per-process. In a multi-instance deployment (Vercel serverless),
 * each function instance has its own store. For distributed rate limiting, swap
 * this for a Redis/Upstash implementation later.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup to avoid memory leaks (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of store.entries()) {
        // Remove entries older than 1 hour
        if (now - entry.windowStart > 60 * 60 * 1000) {
          store.delete(key);
        }
      }
    },
    5 * 60 * 1000
  );
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number; // Unix ms timestamp when the window resets
}

/**
 * Check rate limit for a given identifier.
 *
 * @param identifier - Unique key (e.g. IP address, user ID, or composite)
 * @param limit       - Max requests allowed in the window
 * @param windowMs    - Window duration in milliseconds
 */
export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    store.set(identifier, { count: 1, windowStart: now });
    return {
      success: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.windowStart + windowMs,
    };
  }

  entry.count++;
  return {
    success: true,
    remaining: limit - entry.count,
    resetAt: entry.windowStart + windowMs,
  };
}

// ─── Pre-configured limiters ───────────────────────────────────────────────

/** Login: 5 attempts per 15 minutes per IP */
export function authRateLimit(ip: string): RateLimitResult {
  return rateLimit(`auth:${ip}`, 5, 15 * 60 * 1000);
}

/** Forecast API: 30 requests per minute per user */
export function forecastRateLimit(userId: string): RateLimitResult {
  return rateLimit(`forecast:${userId}`, 30, 60 * 1000);
}

/** Import (bank/QB): 10 uploads per hour per user */
export function importRateLimit(userId: string): RateLimitResult {
  return rateLimit(`import:${userId}`, 10, 60 * 60 * 1000);
}
