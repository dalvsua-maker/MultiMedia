import { NextRequest, NextResponse } from "next/server";
import { EliminarFeedbackRecomendacionUseCase } from "@/application/use-cases/GestionarFeedbackRecomendacion";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cid: string }> }
) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const { cid } = await params;
    const useCase = new EliminarFeedbackRecomendacionUseCase();
    await useCase.execute(usuarioId, cid);
    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error("[DELETE /api/recomendaciones/feedback/:cid]", error);
    return NextResponse.json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
