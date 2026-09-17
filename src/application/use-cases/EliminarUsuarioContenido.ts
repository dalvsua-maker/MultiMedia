import { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from "@/application/errors/AppError";

export class EliminarUsuarioContenidoUseCase {
  constructor(private readonly repo: IUsuarioContenidoRepository) {}

  async execute(usuarioId: string, contenidoId: string): Promise<void> {
    if (!usuarioId) throw new UnauthorizedError("Usuario no autenticado");
    if (!contenidoId) throw new ValidationError("contenidoId es obligatorio");

    const actual = await this.repo.find(usuarioId, contenidoId);
    if (!actual) throw new NotFoundError("Contenido no encontrado en tu cuenta");

    await this.repo.delete(usuarioId, contenidoId);
  }
}
