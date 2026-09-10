import { NextRequest, NextResponse } from "next/server";
import { BuscarUsuariosUseCase } from "@/application/use-cases/BuscarUsuarios";
import { PrismaUsuarioRepository } from "@/infrastructure/repositories/PrismaUsuarioRepository";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function GET(request: NextRequest) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const q = request.nextUrl.searchParams.get("q") ?? "";

    const repo = new PrismaUsuarioRepository();
    const useCase = new BuscarUsuariosUseCase(repo);
    const result = await useCase.execute(usuarioId, q);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("[GET /api/usuarios/buscar]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
