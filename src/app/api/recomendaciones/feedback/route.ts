import { NextRequest, NextResponse } from "next/server";
import { CrearFeedbackRecomendacionUseCase } from "@/application/use-cases/GestionarFeedbackRecomendacion";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function POST(request: NextRequest) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const body = (await request.json()) as { contenidoId?: unknown; voto?: unknown };
    const contenidoId = typeof body.contenidoId === "string" ? body.contenidoId : "";
    const voto = typeof body.voto === "string" ? body.voto : "";

    const useCase = new CrearFeedbackRecomendacionUseCase();
    const result = await useCase.execute(usuarioId, contenidoId, voto);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "JSON no válido", code: "INVALID_JSON" }, { status: 400 });
    }
    console.error("[POST /api/recomendaciones/feedback]", error);
    return NextResponse.json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
