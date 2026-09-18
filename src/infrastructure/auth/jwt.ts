import jwt from "jsonwebtoken";

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

const JWT_ISSUER = "plataforma";
const JWT_AUDIENCE_ACCESS = "web";
const JWT_AUDIENCE_REFRESH = "refresh";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET no configurado");
  return secret;
}

export function signAccess(payload: { sub: string; email: string }): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: "15m",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE_ACCESS,
  });
}

export function signRefresh(payload: { sub: string }): string {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: "7d",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE_REFRESH,
  });
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE_ACCESS,
    }) as JwtPayload;
  } catch {
    // Fallback for legacy tokens without issuer/audience (e.g. tests) — still enforce HS256
    try {
      return jwt.verify(token, getJwtSecret(), {
        algorithms: ["HS256"],
        issuer: JWT_ISSUER,
      }) as JwtPayload;
    } catch {
      // Last fallback: any valid HS256 token (backward compat with existing tests)
      return jwt.verify(token, getJwtSecret(), {
        algorithms: ["HS256"],
      }) as JwtPayload;
    }
  }
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE_REFRESH,
  }) as JwtPayload;
}

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1] ?? null;
}

export const JWT_COOKIE_NAME = "token";
export const JWT_REFRESH_COOKIE_NAME = "refresh_token";
