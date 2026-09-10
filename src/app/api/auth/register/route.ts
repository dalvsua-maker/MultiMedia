import { NextRequest, NextResponse } from "next/server";
import { PrismaUsuarioRepository } from "@/infrastructure/repositories/PrismaUsuarioRepository";
import { RegistrarUsuarioUseCase } from "@/application/use-cases/RegistrarUsuario";
import { AppError } from "@/application/errors/AppError";

export async function POST(request: NextRequest) {
  try {
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

    return NextResponse.json(result, { status: 201 });
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
