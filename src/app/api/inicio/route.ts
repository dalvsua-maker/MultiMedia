import { NextRequest, NextResponse } from "next/server";
import { ObtenerInicioUseCase } from "@/application/use-cases/ObtenerInicio";
import { PrismaUsuarioContenidoRepository } from "@/infrastructure/repositories/PrismaUsuarioContenidoRepository";
import { RecomendacionServiceV2 } from "@/infrastructure/services/RecomendacionServiceV2";
import { AppError } from "@/application/errors/AppError";
import { getAuthenticatedUserId } from "@/app/api/_helpers/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const usuarioId = getAuthenticatedUserId(request);
    const usuarioRepo = new PrismaUsuarioContenidoRepository();
    const recoService = new RecomendacionServiceV2();
    const useCase = new ObtenerInicioUseCase(usuarioRepo, recoService);
    const result = await useCase.execute(usuarioId);
    const res = NextResponse.json(result, { status: 200 });
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res;
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    console.error("[GET /api/inicio]", error);
    return NextResponse.json(
      { error: "Error interno del servidor", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
