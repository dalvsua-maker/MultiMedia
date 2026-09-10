import { NextRequest, NextResponse } from "next/server";
import { PrismaListaRepository } from "@/infrastructure/repositories/PrismaListaRepository";
import { CrearListaUseCase } from "@/application/use-cases/CrearLista";
import { ObtenerListasUseCase } from "@/application/use-cases/ObtenerListas";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function GET(request: NextRequest) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const repo = new PrismaListaRepository();
    const useCase = new ObtenerListasUseCase(repo);
    const listas = await useCase.execute(usuarioId);
    return NextResponse.json(listas, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("[GET /api/listas]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const body = (await request.json()) as {
      nombre?: unknown;
      descripcion?: unknown;
    };

    const dto = {
      nombre: typeof body.nombre === "string" ? body.nombre : "",
      descripcion:
        typeof body.descripcion === "string"
          ? body.descripcion
          : body.descripcion == null
            ? null
            : "",
    };

    const repo = new PrismaListaRepository();
    const useCase = new CrearListaUseCase(repo);
    const result = await useCase.execute(usuarioId, dto);

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
    console.error("[POST /api/listas]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
