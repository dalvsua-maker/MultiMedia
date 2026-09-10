import { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";
import { ListarUsuarioContenidosResponseDto, UsuarioContenidoDto } from "@/application/dtos/UsuarioContenidoDto";
import { UnauthorizedError } from "@/application/errors/AppError";

export class ListarUsuarioContenidosUseCase {
  constructor(private readonly repo: IUsuarioContenidoRepository) {}

  async execute(usuarioId: string): Promise<ListarUsuarioContenidosResponseDto> {
    if (!usuarioId) throw new UnauthorizedError("Usuario no autenticado");

    const rows = await this.repo.findAllByUsuarioId(usuarioId);

    const contenidos: UsuarioContenidoDto[] = rows.map((r) => ({
      contenido: {
        id: r.contenido.id,
        tipo: r.contenido.tipo,
        titulo: r.contenido.titulo,
        imagenUrl: r.contenido.imagenUrl,
        fuenteExterna: r.contenido.fuenteExterna,
        idExterno: r.contenido.idExterno,
        fechaAnadido: r.contenido.fechaAnadido.toISOString(),
        detalle: r.contenido.detalle,
      },
      estado: r.estado,
      fechaActualizacion: r.fechaActualizacion.toISOString(),
    }));

    return { contenidos, total: contenidos.length };
  }
}
