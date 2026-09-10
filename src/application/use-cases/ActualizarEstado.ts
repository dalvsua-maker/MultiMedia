import { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";
import { isEstadoValido } from "@/domain/services/TransicionEstado";
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from "@/application/errors/AppError";
import type { EstadoContenido } from "@/domain/entities/Contenido";

export class ActualizarEstadoUseCase {
  constructor(private readonly repo: IUsuarioContenidoRepository) {}

  async execute(
    usuarioId: string,
    contenidoId: string,
    estadoRaw: string
  ): Promise<{ estado: EstadoContenido }> {
    if (!usuarioId) throw new UnauthorizedError("Usuario no autenticado");
    if (!contenidoId) throw new ValidationError("contenidoId es obligatorio");
    if (!estadoRaw || !isEstadoValido(estadoRaw)) {
      throw new ValidationError("estado debe ser pendiente, en_proceso o visto");
    }
    const nuevoEstado = estadoRaw as EstadoContenido;

    const actual = await this.repo.find(usuarioId, contenidoId);
    if (!actual) throw new NotFoundError("Contenido no encontrado en tu cuenta");

    if (actual.estado === nuevoEstado) {
      // idempotente: mismo estado, no error
      return { estado: actual.estado };
    }

    await this.repo.updateEstado(usuarioId, contenidoId, nuevoEstado);

    return { estado: nuevoEstado };
  }
}
