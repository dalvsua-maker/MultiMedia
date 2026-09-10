import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/application/errors/AppError";
import {
  verifyToken,
  extractBearerToken,
} from "@/infrastructure/auth/jwt";

export function getAuthenticatedUserId(request: NextRequest): string {
  const authHeader = request.headers.get("authorization");
  const token = extractBearerToken(authHeader);
  if (!token) throw new UnauthorizedError("Token no proporcionado");
  try {
    const payload = verifyToken(token);
    return payload.sub;
  } catch {
    throw new UnauthorizedError("Token no válido o expirado");
  }
}
