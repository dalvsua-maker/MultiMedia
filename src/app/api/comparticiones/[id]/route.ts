import { NextRequest, NextResponse } from "next/server";
import { ResponderComparticionUseCase } from "@/application/use-cases/ResponderComparticion";
import { PrismaComparticionRepository } from "@/infrastructure/repositories/PrismaComparticionRepository";
import { PrismaUsuarioContenidoRepository } from "@/infrastructure/repositories/PrismaUsuarioContenidoRepository";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const { id } = await params;
    const body = (await request.json()) as { accion?: unknown };
    const accion = typeof body.accion === "string" ? body.accion : "";

    const comparticionRepo = new PrismaComparticionRepository();
    const usuarioContenidoRepo = new PrismaUsuarioContenidoRepository();
    const useCase = new ResponderComparticionUseCase(
      comparticionRepo,
      usuarioContenidoRepo
    );

    const result = await useCase.execute(usuarioId, id, accion);

    return NextResponse.json(result, { status: 200 });
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
    console.error("[PATCH /api/comparticiones/:id]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
