import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/application/errors/AppError";
import {
  verifyToken,
  extractBearerToken,
  JWT_COOKIE_NAME,
} from "@/infrastructure/auth/jwt";

function getCookieToken(request: NextRequest): string | null {
  // NextRequest has cookies API (sync)
  const viaNextCookies = (request.cookies?.get(JWT_COOKIE_NAME)?.value ??
    request.cookies?.get("token")?.value) as string | undefined;
  if (viaNextCookies) return viaNextCookies;
  // Fallback: parse Cookie header directly (for generic Request or test mocks)
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

export function getAuthenticatedUserId(request: NextRequest): string {
  const authHeader = request.headers.get("authorization");
  const bearer = extractBearerToken(authHeader);
  const cookieToken = getCookieToken(request);
  const token = bearer ?? cookieToken;
  if (!token) throw new UnauthorizedError("Token no proporcionado");
  try {
    const payload = verifyToken(token);
    return payload.sub;
  } catch {
    throw new UnauthorizedError("Token no válido o expirado");
  }
}

// Async variant that reads from next/headers cookies() (Next 16 async)
// Useful if handler uses generic Request without NextRequest cookies populated
export async function getAuthenticatedUserIdFromCookies(): Promise<string> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token =
    cookieStore.get(JWT_COOKIE_NAME)?.value ?? cookieStore.get("token")?.value ?? null;
  if (!token) throw new UnauthorizedError("Token no proporcionado");
  try {
    const payload = verifyToken(token);
    return payload.sub;
  } catch {
    throw new UnauthorizedError("Token no válido o expirado");
  }
}
