import { NextRequest, NextResponse } from "next/server";
import { CrearContenidoUseCase } from "@/application/use-cases/CrearContenido";
import { PrismaContenidoRepository } from "@/infrastructure/repositories/PrismaContenidoRepository";
import { PrismaUsuarioContenidoRepository } from "@/infrastructure/repositories/PrismaUsuarioContenidoRepository";
import { PrismaListaRepository } from "@/infrastructure/repositories/PrismaListaRepository";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function POST(request: NextRequest) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const body = (await request.json()) as {
      tipo?: unknown;
      titulo?: unknown;
      imagenUrl?: unknown;
      fuenteExterna?: unknown;
      idExterno?: unknown;
      detalle?: unknown;
      listaId?: unknown;
    };

    const dto = {
      tipo: typeof body.tipo === "string" ? body.tipo : "",
      titulo: typeof body.titulo === "string" ? body.titulo : "",
      imagenUrl:
        typeof body.imagenUrl === "string" ? body.imagenUrl : body.imagenUrl == null ? null : "",
      fuenteExterna: typeof body.fuenteExterna === "string" ? body.fuenteExterna : "",
      idExterno: typeof body.idExterno === "string" ? body.idExterno : "",
      detalle: (body.detalle as Record<string, unknown> | null) ?? null,
      listaId: typeof body.listaId === "string" ? body.listaId : body.listaId == null ? null : "",
    } as {
      tipo: string;
      titulo: string;
      imagenUrl: string | null;
      fuenteExterna: string;
      idExterno: string;
      detalle: Record<string, unknown> | null;
      listaId: string | null;
    };

    const contenidoRepo = new PrismaContenidoRepository();
    const usuarioContenidoRepo = new PrismaUsuarioContenidoRepository();
    const listaRepo = new PrismaListaRepository();
    const useCase = new CrearContenidoUseCase(
      contenidoRepo,
      usuarioContenidoRepo,
      listaRepo
    );

    const result = await useCase.execute(usuarioId, dto as never);

    const status = result.yaExistia ? 200 : 201;
    return NextResponse.json(result, { status });
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
    console.error("[POST /api/contenidos]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
