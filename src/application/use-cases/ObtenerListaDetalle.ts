import { IListaRepository } from "@/domain/repositories/IListaRepository";
import { ListaDetalleDto } from "@/application/dtos/ListaDto";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
} from "@/application/errors/AppError";

export class ObtenerListaDetalleUseCase {
  constructor(private readonly listaRepo: IListaRepository) {}

  async execute(usuarioId: string, listaId: string): Promise<ListaDetalleDto> {
    if (!usuarioId) throw new ValidationError("Usuario no autenticado");
    if (!listaId) throw new ValidationError("Lista id es obligatorio");

    const detalle = await this.listaRepo.findByIdWithContenidos(listaId);
    if (!detalle) throw new NotFoundError("Lista no encontrada");
    if (detalle.usuarioId !== usuarioId) {
      throw new ForbiddenError("No tienes acceso a esta lista");
    }

    return {
      id: detalle.id,
      usuarioId: detalle.usuarioId,
      nombre: detalle.nombre,
      descripcion: detalle.descripcion,
      fechaCreacion: detalle.fechaCreacion.toISOString(),
      contenidos: detalle.contenidos.map((c) => ({
        id: c.id,
        tipo: c.tipo,
        titulo: c.titulo,
        imagenUrl: c.imagenUrl,
        fuenteExterna: c.fuenteExterna,
        idExterno: c.idExterno,
        fechaAnadido: c.fechaAnadido.toISOString(),
      })),
    };
  }
}
