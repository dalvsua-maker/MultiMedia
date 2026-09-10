import { prisma } from "@/infrastructure/database/prisma";
import { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";
import type { EstadoContenido } from "@/domain/entities/Contenido";

export class PrismaUsuarioContenidoRepository implements IUsuarioContenidoRepository {
  async find(
    usuarioId: string,
    contenidoId: string
  ): Promise<{ estado: EstadoContenido; fechaActualizacion: Date } | null> {
    const found = await prisma.usuarioContenido.findUnique({
      where: { usuarioId_contenidoId: { usuarioId, contenidoId } },
    });
    if (!found) return null;
    return {
      estado: found.estado as EstadoContenido,
      fechaActualizacion: found.fechaActualizacion,
    };
  }

  async exists(usuarioId: string, contenidoId: string): Promise<boolean> {
    const found = await prisma.usuarioContenido.findUnique({
      where: { usuarioId_contenidoId: { usuarioId, contenidoId } },
    });
    return !!found;
  }

  async create(
    usuarioId: string,
    contenidoId: string,
    estado: EstadoContenido = "pendiente"
  ): Promise<void> {
    await prisma.usuarioContenido.create({
      data: { usuarioId, contenidoId, estado },
    });
  }

  async findAllByUsuarioId(usuarioId: string): Promise<
    Array<{
      contenido: import("@/domain/entities/Contenido").ContenidoConDetalle;
      estado: EstadoContenido;
      fechaActualizacion: Date;
    }>
  > {
    const rows = await prisma.usuarioContenido.findMany({
      where: { usuarioId },
      include: {
        contenido: {
          include: {
            detallePelicula: true,
            detalleSerie: true,
            detalleVideojuego: true,
            detalleMusica: true,
          },
        },
      },
      orderBy: { fechaActualizacion: "desc" },
    });

    return rows.map((r) => ({
      contenido: {
        id: r.contenido.id,
        tipo: r.contenido.tipo as import("@/domain/entities/Contenido").TipoContenido,
        titulo: r.contenido.titulo,
        imagenUrl: r.contenido.imagenUrl,
        fuenteExterna: r.contenido.fuenteExterna as import("@/domain/entities/Contenido").FuenteExterna,
        idExterno: r.contenido.idExterno,
        fechaAnadido: r.contenido.fechaAnadido,
        detalle: mapDetalle(r.contenido as never),
      },
      estado: r.estado as EstadoContenido,
      fechaActualizacion: r.fechaActualizacion,
    }));
  }

  async updateEstado(
    usuarioId: string,
    contenidoId: string,
    estado: EstadoContenido
  ): Promise<void> {
    await prisma.usuarioContenido.update({
      where: { usuarioId_contenidoId: { usuarioId, contenidoId } },
      data: { estado, fechaActualizacion: new Date() },
    });
  }
}

function mapDetalle(found: {
  tipo: string;
  detallePelicula: { duracionMin: number | null; director: string | null; anio: number | null } | null;
  detalleSerie: { numTemporadas: number | null; numEpisodios: number | null; anioInicio: number | null } | null;
  detalleVideojuego: { plataformas: string[]; desarrollador: string | null; anioLanzamiento: number | null } | null;
  detalleMusica: { artista: string | null; album: string | null; duracionSeg: number | null } | null;
}): import("@/domain/entities/Contenido").ContenidoConDetalle["detalle"] {
  switch (found.tipo) {
    case "pelicula":
      return found.detallePelicula ? { _tipo: "pelicula", ...found.detallePelicula } : null;
    case "serie":
      return found.detalleSerie ? { _tipo: "serie", ...found.detalleSerie } : null;
    case "videojuego":
      return found.detalleVideojuego ? { _tipo: "videojuego", ...found.detalleVideojuego } : null;
    case "musica":
      return found.detalleMusica ? { _tipo: "musica", ...found.detalleMusica } : null;
    default:
      return null;
  }
}
