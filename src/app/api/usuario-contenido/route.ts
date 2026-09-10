import { NextRequest, NextResponse } from "next/server";
import { ListarUsuarioContenidosUseCase } from "@/application/use-cases/ListarUsuarioContenidos";
import { PrismaUsuarioContenidoRepository } from "@/infrastructure/repositories/PrismaUsuarioContenidoRepository";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function GET(request: NextRequest) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const repo = new PrismaUsuarioContenidoRepository();
    const useCase = new ListarUsuarioContenidosUseCase(repo);
    const result = await useCase.execute(usuarioId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("[GET /api/usuario-contenido]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
