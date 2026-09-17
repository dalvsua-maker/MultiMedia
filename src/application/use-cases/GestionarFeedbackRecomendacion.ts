import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from "@/application/errors/AppError";
import { prisma } from "@/infrastructure/database/prisma";

const VOTOS_VALIDOS = ["me_gusta", "no_me_gusta", "ya_lo_vi"] as const;
export type VotoRecomendacion = (typeof VOTOS_VALIDOS)[number];

export class CrearFeedbackRecomendacionUseCase {
  async execute(usuarioId: string, contenidoId: string, votoRaw: string): Promise<{ voto: VotoRecomendacion }> {
    if (!usuarioId) throw new UnauthorizedError("Usuario no autenticado");
    if (!contenidoId) throw new ValidationError("contenidoId es obligatorio");
    if (!VOTOS_VALIDOS.includes(votoRaw as VotoRecomendacion)) {
      throw new ValidationError("voto debe ser me_gusta, no_me_gusta o ya_lo_vi");
    }
    const voto = votoRaw as VotoRecomendacion;

    const contenidoExists = await prisma.contenido.findUnique({ where: { id: contenidoId } });
    if (!contenidoExists) throw new NotFoundError("Contenido no encontrado");

    await prisma.recomendacionFeedback.upsert({
      where: { usuarioId_contenidoId: { usuarioId, contenidoId } },
      create: { usuarioId, contenidoId, voto },
      update: { voto, fecha: new Date() },
    });

    return { voto };
  }
}

export class EliminarFeedbackRecomendacionUseCase {
  async execute(usuarioId: string, contenidoId: string): Promise<void> {
    if (!usuarioId) throw new UnauthorizedError("Usuario no autenticado");
    if (!contenidoId) throw new ValidationError("contenidoId es obligatorio");

    const existing = await prisma.recomendacionFeedback.findUnique({
      where: { usuarioId_contenidoId: { usuarioId, contenidoId } },
    });
    if (!existing) throw new NotFoundError("Feedback no encontrado");

    await prisma.recomendacionFeedback.delete({
      where: { usuarioId_contenidoId: { usuarioId, contenidoId } },
    });
  }
}
