import { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";
import { IRecomendacionService } from "@/domain/services/IRecomendacionService";
import { InicioResponseDto } from "@/application/dtos/InicioDto";
import { UnauthorizedError } from "@/application/errors/AppError";

export class ObtenerInicioUseCase {
  constructor(
    private readonly usuarioContenidoRepo: IUsuarioContenidoRepository,
    private readonly recomendacionService: IRecomendacionService
  ) {}

  async execute(usuarioId: string): Promise<InicioResponseDto> {
    if (!usuarioId) throw new UnauthorizedError("Usuario no autenticado");

    const todos = await this.usuarioContenidoRepo.findAllByUsuarioId(usuarioId);

    const enProceso = todos
      .filter((r) => r.estado === "en_proceso")
      .sort((a, b) => b.fechaActualizacion.getTime() - a.fechaActualizacion.getTime())
      .map((r) => ({
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

    const recomendacionesRaw = await this.recomendacionService.recomendar(usuarioId);

    const recomendaciones = recomendacionesRaw.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      titulo: c.titulo,
      imagenUrl: c.imagenUrl,
      fuenteExterna: c.fuenteExterna,
      idExterno: c.idExterno,
      fechaAnadido: c.fechaAnadido.toISOString(),
      detalle: c.detalle,
    }));

    return { enProceso, recomendaciones };
  }
}
