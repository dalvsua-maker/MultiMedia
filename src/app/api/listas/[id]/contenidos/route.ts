import { NextRequest, NextResponse } from "next/server";
import { PrismaListaRepository } from "@/infrastructure/repositories/PrismaListaRepository";
import { AnadirContenidoAListaUseCase } from "@/application/use-cases/AnadirContenidoALista";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const { id: listaId } = await params;
    const body = (await request.json()) as { contenidoId?: unknown };
    const contenidoId =
      typeof body.contenidoId === "string" ? body.contenidoId : "";

    const repo = new PrismaListaRepository();
    const useCase = new AnadirContenidoAListaUseCase(repo);
    await useCase.execute(usuarioId, listaId, contenidoId);

    return NextResponse.json(
      { message: "Contenido añadido a la lista" },
      { status: 201 }
    );
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
    console.error("[POST /api/listas/:id/contenidos]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
