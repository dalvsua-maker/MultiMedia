import { IListaRepository } from "@/domain/repositories/IListaRepository";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "@/application/errors/AppError";

export class QuitarContenidoDeListaUseCase {
  constructor(private readonly listaRepo: IListaRepository) {}

  async execute(
    usuarioId: string,
    listaId: string,
    contenidoId: string
  ): Promise<void> {
    if (!usuarioId) throw new ValidationError("Usuario no autenticado");
    if (!listaId) throw new ValidationError("Lista id es obligatorio");
    if (!contenidoId) throw new ValidationError("contenidoId es obligatorio");

    const lista = await this.listaRepo.findById(listaId);
    if (!lista) throw new NotFoundError("Lista no encontrada");
    if (lista.usuarioId !== usuarioId) {
      throw new ForbiddenError("No tienes acceso a esta lista");
    }

    const exists = await this.listaRepo.existsContenidoInLista(
      listaId,
      contenidoId
    );
    if (!exists) throw new NotFoundError("El contenido no está en la lista");

    await this.listaRepo.removeContenido(listaId, contenidoId);
  }
}
