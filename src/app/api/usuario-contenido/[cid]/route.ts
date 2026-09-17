import { NextRequest, NextResponse } from "next/server";
import { ActualizarEstadoUseCase } from "@/application/use-cases/ActualizarEstado";
import { EliminarUsuarioContenidoUseCase } from "@/application/use-cases/EliminarUsuarioContenido";
import { PrismaUsuarioContenidoRepository } from "@/infrastructure/repositories/PrismaUsuarioContenidoRepository";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const { cid } = await params;
    const body = (await request.json()) as { estado?: unknown };
    const estado = typeof body.estado === "string" ? body.estado : "";

    const repo = new PrismaUsuarioContenidoRepository();
    const useCase = new ActualizarEstadoUseCase(repo);
    const result = await useCase.execute(usuarioId, cid, estado);

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
    console.error("[PATCH /api/usuario-contenido/:cid]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const { cid } = await params;

    const repo = new PrismaUsuarioContenidoRepository();
    const useCase = new EliminarUsuarioContenidoUseCase(repo);
    await useCase.execute(usuarioId, cid);

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("[DELETE /api/usuario-contenido/:cid]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
