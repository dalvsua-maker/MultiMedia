import { NextRequest, NextResponse } from "next/server";
import { CompartirContenidoUseCase } from "@/application/use-cases/CompartirContenido";
import { ListarComparticionesUseCase } from "@/application/use-cases/ListarComparticiones";
import { PrismaComparticionRepository } from "@/infrastructure/repositories/PrismaComparticionRepository";
import { PrismaContenidoRepository } from "@/infrastructure/repositories/PrismaContenidoRepository";
import { PrismaUsuarioRepository } from "@/infrastructure/repositories/PrismaUsuarioRepository";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function POST(request: NextRequest) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const body = (await request.json()) as {
      contenidoId?: unknown;
      usuarioDestinoId?: unknown;
    };

    const contenidoId = typeof body.contenidoId === "string" ? body.contenidoId : "";
    const usuarioDestinoId =
      typeof body.usuarioDestinoId === "string" ? body.usuarioDestinoId : "";

    const comparticionRepo = new PrismaComparticionRepository();
    const contenidoRepo = new PrismaContenidoRepository();
    const usuarioRepo = new PrismaUsuarioRepository();
    const useCase = new CompartirContenidoUseCase(
      comparticionRepo,
      contenidoRepo,
      usuarioRepo
    );

    const { comparticion, status } = await useCase.execute(
      usuarioId,
      contenidoId,
      usuarioDestinoId
    );

    return NextResponse.json(comparticion, { status });
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
    console.error("[POST /api/comparticiones]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const repo = new PrismaComparticionRepository();
    const useCase = new ListarComparticionesUseCase(repo);
    const result = await useCase.execute(usuarioId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("[GET /api/comparticiones]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
