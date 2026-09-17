import { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";
import { IRecomendacionService } from "@/domain/services/IRecomendacionService";
import { InicioResponseDto } from "@/application/dtos/InicioDto";
import { UnauthorizedError } from "@/application/errors/AppError";
import { RecomendacionServiceV2 } from "@/infrastructure/services/RecomendacionServiceV2";

export class ObtenerInicioUseCase {
  constructor(
    private readonly usuarioContenidoRepo: IUsuarioContenidoRepository,
    private readonly recomendacionService: IRecomendacionService | RecomendacionServiceV2
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

    // V2 grouped path: if service has recomendarAgrupado, use it
    const svc = this.recomendacionService as RecomendacionServiceV2;
    if (typeof svc.recomendarAgrupado === "function") {
      const agrupado = await svc.recomendarAgrupado(usuarioId);
      const tipos = ["pelicula", "serie", "videojuego", "musica"] as const;
      const recomendacionesPorTipo: InicioResponseDto["recomendacionesPorTipo"] = {
        pelicula: [],
        serie: [],
        videojuego: [],
        musica: [],
      };
      const recomendaciones: InicioResponseDto["recomendaciones"] = [];
      for (const t of tipos) {
        const arr = (agrupado[t] ?? []).map((c) => ({
          id: c.id,
          tipo: c.tipo,
          titulo: c.titulo,
          imagenUrl: c.imagenUrl,
          fuenteExterna: c.fuenteExterna,
          idExterno: c.idExterno,
          fechaAnadido: c.fechaAnadido.toISOString(),
          detalle: c.detalle,
          yaAnadido: (c as unknown as { yaAnadido: boolean }).yaAnadido ?? false,
        }));
        recomendacionesPorTipo[t] = arr;
        recomendaciones.push(...arr);
      }
      return { enProceso, recomendaciones, recomendacionesPorTipo };
    }

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

    return {
      enProceso,
      recomendaciones,
      recomendacionesPorTipo: {
        pelicula: recomendaciones.filter((r) => r.tipo === "pelicula").map((r) => ({ ...r, yaAnadido: false })),
        serie: recomendaciones.filter((r) => r.tipo === "serie").map((r) => ({ ...r, yaAnadido: false })),
        videojuego: recomendaciones.filter((r) => r.tipo === "videojuego").map((r) => ({ ...r, yaAnadido: false })),
        musica: recomendaciones.filter((r) => r.tipo === "musica").map((r) => ({ ...r, yaAnadido: false })),
      },
    };
  }
}
