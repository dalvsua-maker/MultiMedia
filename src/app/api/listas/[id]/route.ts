import { NextRequest, NextResponse } from "next/server";
import { PrismaListaRepository } from "@/infrastructure/repositories/PrismaListaRepository";
import { ObtenerListaDetalleUseCase } from "@/application/use-cases/ObtenerListaDetalle";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const { id } = await params;

    const repo = new PrismaListaRepository();
    const useCase = new ObtenerListaDetalleUseCase(repo);
    const detalle = await useCase.execute(usuarioId, id);

    return NextResponse.json(detalle, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("[GET /api/listas/:id]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
