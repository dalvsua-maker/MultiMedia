import { NextRequest, NextResponse } from "next/server";
import { PrismaUsuarioRepository } from "@/infrastructure/repositories/PrismaUsuarioRepository";
import { RegistrarUsuarioUseCase } from "@/application/use-cases/RegistrarUsuario";
import { AppError } from "@/application/errors/AppError";
import { signRefresh } from "@/infrastructure/auth/jwt";
import { checkAuthRateLimit } from "@/app/api/_helpers/rateLimit";

export async function POST(request: NextRequest) {
  try {
    checkAuthRateLimit(request);
    const body = (await request.json()) as {
      nombre?: unknown;
      email?: unknown;
      password?: unknown;
    };

    const dto = {
      nombre: typeof body.nombre === "string" ? body.nombre : "",
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
    };

    const repo = new PrismaUsuarioRepository();
    const useCase = new RegistrarUsuarioUseCase(repo);
    const result = await useCase.execute(dto);

    const refreshToken = signRefresh({ sub: result.usuario.id });
    const isProd = process.env.NODE_ENV === "production";
    const res = NextResponse.json({ usuario: result.usuario }, { status: 201 });
    res.cookies.set("token", result.token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 15,
      path: "/",
    });
    res.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/api/auth/refresh",
    });
    return res;
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "JSON no válido", code: "INVALID_JSON" },
        { status: 400 }
      );
    }
    console.error("[POST /api/auth/register]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
