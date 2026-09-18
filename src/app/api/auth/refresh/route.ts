import { NextRequest, NextResponse } from "next/server";
import { PrismaUsuarioRepository } from "@/infrastructure/repositories/PrismaUsuarioRepository";
import {
  verifyRefreshToken,
  signAccess,
  JWT_REFRESH_COOKIE_NAME,
} from "@/infrastructure/auth/jwt";

export async function POST(request: NextRequest) {
  try {
    const refreshToken =
      request.cookies.get(JWT_REFRESH_COOKIE_NAME)?.value ??
      request.cookies.get("refresh_token")?.value ??
      null;

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token no proporcionado", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    let payload: { sub: string };
    try {
      payload = verifyRefreshToken(refreshToken) as { sub: string };
    } catch {
      return NextResponse.json(
        { error: "Refresh token no válido o expirado", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const repo = new PrismaUsuarioRepository();
    const usuario = await repo.findById(payload.sub);

    if (!usuario) {
      return NextResponse.json(
        { error: "Usuario no encontrado", code: "NOT_FOUND" },
        { status: 401 }
      );
    }

    const newAccess = signAccess({ sub: usuario.id, email: usuario.email });
    const isProd = process.env.NODE_ENV === "production";
    const res = NextResponse.json({ ok: true }, { status: 200 });
    res.cookies.set("token", newAccess, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 15,
      path: "/",
    });
    return res;
  } catch (error) {
    console.error("[POST /api/auth/refresh]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
