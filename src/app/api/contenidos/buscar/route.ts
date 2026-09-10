import { NextRequest, NextResponse } from "next/server";
import { BuscarContenidoUseCase } from "@/application/use-cases/BuscarContenido";
import { ExternalSearchService } from "@/infrastructure/services/ExternalSearchService";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function GET(request: NextRequest) {
  try {
    // Auth requerida (igual que /api/listas)
    getAuthenticatedUserId(request);

    const { searchParams } = request.nextUrl;
    const tipo = searchParams.get("tipo") ?? "";
    const q = searchParams.get("q") ?? "";

    const service = new ExternalSearchService();
    const useCase = new BuscarContenidoUseCase(service);
    const result = await useCase.execute(tipo, q);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("[GET /api/contenidos/buscar]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
