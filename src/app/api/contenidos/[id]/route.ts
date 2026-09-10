import { NextRequest, NextResponse } from "next/server";
import { ObtenerContenidoDetalleUseCase } from "@/application/use-cases/ObtenerContenidoDetalle";
import { PrismaContenidoRepository } from "@/infrastructure/repositories/PrismaContenidoRepository";
import { PrismaUsuarioContenidoRepository } from "@/infrastructure/repositories/PrismaUsuarioContenidoRepository";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const { id } = await params;

    const contenidoRepo = new PrismaContenidoRepository();
    const usuarioContenidoRepo = new PrismaUsuarioContenidoRepository();
    const useCase = new ObtenerContenidoDetalleUseCase(
      contenidoRepo,
      usuarioContenidoRepo
    );

    const result = await useCase.execute(usuarioId, id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("[GET /api/contenidos/:id]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
