import { IContenidoRepository } from "@/domain/repositories/IContenidoRepository";
import { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";
import { ObtenerContenidoDetalleResponseDto } from "@/application/dtos/ContenidoDto";
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from "@/application/errors/AppError";
import type { EstadoContenido } from "@/domain/entities/Contenido";

export class ObtenerContenidoDetalleUseCase {
  constructor(
    private readonly contenidoRepo: IContenidoRepository,
    private readonly usuarioContenidoRepo: IUsuarioContenidoRepository
  ) {}

  async execute(
    usuarioId: string,
    contenidoId: string
  ): Promise<ObtenerContenidoDetalleResponseDto> {
    if (!usuarioId) throw new UnauthorizedError("Usuario no autenticado");
    if (!contenidoId) throw new ValidationError("contenidoId es obligatorio");

    const conDetalle = await this.contenidoRepo.findByIdConDetalle(contenidoId);
    if (!conDetalle) throw new NotFoundError("Contenido no encontrado");

    const uc = await this.usuarioContenidoRepo.find(usuarioId, contenidoId);

    return {
      contenido: {
        id: conDetalle.id,
        tipo: conDetalle.tipo,
        titulo: conDetalle.titulo,
        imagenUrl: conDetalle.imagenUrl,
        fuenteExterna: conDetalle.fuenteExterna,
        idExterno: conDetalle.idExterno,
        fechaAnadido: conDetalle.fechaAnadido.toISOString(),
        detalle: conDetalle.detalle,
      },
      estadoUsuario: (uc?.estado as EstadoContenido) ?? null,
    };
  }
}
