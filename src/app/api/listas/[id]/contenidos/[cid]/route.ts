import { NextRequest, NextResponse } from "next/server";
import { PrismaListaRepository } from "@/infrastructure/repositories/PrismaListaRepository";
import { QuitarContenidoDeListaUseCase } from "@/application/use-cases/QuitarContenidoDeLista";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cid: string }> }
) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const { id: listaId, cid: contenidoId } = await params;

    const repo = new PrismaListaRepository();
    const useCase = new QuitarContenidoDeListaUseCase(repo);
    await useCase.execute(usuarioId, listaId, contenidoId);

    return NextResponse.json(
      { message: "Contenido eliminado de la lista" },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("[DELETE /api/listas/:id/contenidos/:cid]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
