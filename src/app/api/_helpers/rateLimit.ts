import { NextRequest } from "next/server";
import { AppError } from "@/application/errors/AppError";

type Bucket = { count: number; resetMs: number };

// Global store survives HMR via globalThis
const globalStore = globalThis as unknown as { __rlStore?: Map<string, Bucket> };
if (!globalStore.__rlStore) globalStore.__rlStore = new Map<string, Bucket>();
const store: Map<string, Bucket> = globalStore.__rlStore;

function getIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return (
    request.headers.get("x-real-ip") ??
    // NextRequest has no direct ip in Node runtime; fallback to header
    "unknown"
  );
}

/**
 * Simple in-memory fixed-window rate limiter — TEMPORAL patch.
 * NOT distributed (per-instance). Replace with Redis/Upstash for prod.
 * @param request NextRequest
 * @param opts keyPrefix, limit, windowMs
 * @throws AppError 429 if exceeded
 */
export function checkRateLimit(
  request: NextRequest,
  opts: { keyPrefix: string; limit: number; windowMs: number }
): void {
  const ip = getIp(request);
  const key = `${opts.keyPrefix}:${ip}`;
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetMs) {
    store.set(key, { count: 1, resetMs: now + opts.windowMs });
    return;
  }

  bucket.count += 1;
  if (bucket.count > opts.limit) {
    throw new AppError("Demasiadas peticiones, intenta más tarde", 429, "RATE_LIMITED");
  }
}

// Convenience presets
export function checkAuthRateLimit(request: NextRequest): void {
  // 5 intentos por minuto por IP
  checkRateLimit(request, { keyPrefix: "auth", limit: 5, windowMs: 60_000 });
}

export function checkBuscarRateLimit(request: NextRequest): void {
  // 20 búsquedas por minuto por IP (protege APIs externas)
  checkRateLimit(request, { keyPrefix: "buscar", limit: 20, windowMs: 60_000 });
}

// Test helper: clear store
export function _clearRateLimitStore(): void {
  store.clear();
}
