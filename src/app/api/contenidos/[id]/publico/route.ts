import { NextRequest, NextResponse } from "next/server";
import { ObtenerContenidoPublicoUseCase } from "@/application/use-cases/ObtenerContenidoPublico";
import { PrismaContenidoRepository } from "@/infrastructure/repositories/PrismaContenidoRepository";
import { AppError } from "@/application/errors/AppError";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const repo = new PrismaContenidoRepository();
    const useCase = new ObtenerContenidoPublicoUseCase(repo);
    const result = await useCase.execute(id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("[GET /api/contenidos/:id/publico]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
