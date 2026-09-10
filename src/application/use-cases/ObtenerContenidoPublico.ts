import { IContenidoRepository } from "@/domain/repositories/IContenidoRepository";
import { ContenidoPublicoDto } from "@/application/dtos/ComparticionDto";
import { NotFoundError } from "@/application/errors/AppError";

export class ObtenerContenidoPublicoUseCase {
  constructor(private readonly contenidoRepo: IContenidoRepository) {}

  async execute(contenidoId: string): Promise<ContenidoPublicoDto> {
    if (!contenidoId) throw new NotFoundError("Contenido no encontrado");
    const found = await this.contenidoRepo.findByIdConDetalle(contenidoId);
    if (!found) throw new NotFoundError("Contenido no encontrado");

    return {
      id: found.id,
      titulo: found.titulo,
      imagenUrl: found.imagenUrl,
      tipo: found.tipo,
      fuenteExterna: found.fuenteExterna,
      idExterno: found.idExterno,
      detalle: found.detalle as ContenidoPublicoDto["detalle"],
    };
  }
}
