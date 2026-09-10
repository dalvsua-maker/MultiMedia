import { prisma } from "@/infrastructure/database/prisma";
import {
  Contenido,
  ContenidoConDetalle,
  TipoContenido,
  FuenteExterna,
} from "@/domain/entities/Contenido";
import {
  IContenidoRepository,
  CrearContenidoData,
} from "@/domain/repositories/IContenidoRepository";

function toContenido(raw: {
  id: string;
  tipo: string;
  titulo: string;
  imagenUrl: string | null;
  fuenteExterna: string;
  idExterno: string;
  fechaAnadido: Date;
}): Contenido {
  return new Contenido({
    id: raw.id,
    tipo: raw.tipo as TipoContenido,
    titulo: raw.titulo,
    imagenUrl: raw.imagenUrl,
    fuenteExterna: raw.fuenteExterna as FuenteExterna,
    idExterno: raw.idExterno,
    fechaAnadido: raw.fechaAnadido,
  });
}

export class PrismaContenidoRepository implements IContenidoRepository {
  async findByFuenteExternaAndIdExterno(
    fuenteExterna: FuenteExterna,
    idExterno: string
  ): Promise<Contenido | null> {
    const found = await prisma.contenido.findUnique({
      where: { fuenteExterna_idExterno: { fuenteExterna, idExterno } },
    });
    return found ? toContenido(found) : null;
  }

  async findById(id: string): Promise<Contenido | null> {
    const found = await prisma.contenido.findUnique({ where: { id } });
    return found ? toContenido(found) : null;
  }

  async findByIdConDetalle(id: string): Promise<ContenidoConDetalle | null> {
    const found = await prisma.contenido.findUnique({
      where: { id },
      include: {
        detallePelicula: true,
        detalleSerie: true,
        detalleVideojuego: true,
        detalleMusica: true,
      },
    });
    if (!found) return null;

    return {
      id: found.id,
      tipo: found.tipo as TipoContenido,
      titulo: found.titulo,
      imagenUrl: found.imagenUrl,
      fuenteExterna: found.fuenteExterna as FuenteExterna,
      idExterno: found.idExterno,
      fechaAnadido: found.fechaAnadido,
      detalle: mapDetalle(found),
    };
  }

  async findByIdConDetalleYEstado(
    contenidoId: string,
    usuarioId: string
  ): Promise<(ContenidoConDetalle & { estadoUsuario: string | null }) | null> {
    const found = await this.findByIdConDetalle(contenidoId);
    if (!found) return null;
    const uc = await prisma.usuarioContenido.findUnique({
      where: { usuarioId_contenidoId: { usuarioId, contenidoId } },
    });
    return { ...found, estadoUsuario: uc?.estado ?? null };
  }

  async create(data: CrearContenidoData): Promise<Contenido> {
    const created = await prisma.$transaction(async (tx) => {
      const contenido = await tx.contenido.create({
        data: {
          tipo: data.tipo,
          titulo: data.titulo,
          imagenUrl: data.imagenUrl ?? null,
          fuenteExterna: data.fuenteExterna,
          idExterno: data.idExterno,
        },
      });

      if (data.detalle) {
        const d = data.detalle as Record<string, unknown>;
        switch (data.tipo) {
          case "pelicula":
            await tx.detallePelicula.create({
              data: {
                contenidoId: contenido.id,
                duracionMin: (d.duracionMin as number) ?? null,
                director: (d.director as string) ?? null,
                anio: (d.anio as number) ?? null,
              },
            });
            break;
          case "serie":
            await tx.detalleSerie.create({
              data: {
                contenidoId: contenido.id,
                numTemporadas: (d.numTemporadas as number) ?? null,
                numEpisodios: (d.numEpisodios as number) ?? null,
                anioInicio: (d.anioInicio as number) ?? null,
              },
            });
            break;
          case "videojuego":
            await tx.detalleVideojuego.create({
              data: {
                contenidoId: contenido.id,
                plataformas: (d.plataformas as string[]) ?? [],
                desarrollador: (d.desarrollador as string) ?? null,
                anioLanzamiento: (d.anioLanzamiento as number) ?? null,
              },
            });
            break;
          case "musica":
            await tx.detalleMusica.create({
              data: {
                contenidoId: contenido.id,
                artista: (d.artista as string) ?? null,
                album: (d.album as string) ?? null,
                duracionSeg: (d.duracionSeg as number) ?? null,
              },
            });
            break;
        }
      }

      return contenido;
    });

    return toContenido(created);
  }
}

function mapDetalle(found: {
  tipo: string;
  detallePelicula: { duracionMin: number | null; director: string | null; anio: number | null } | null;
  detalleSerie: { numTemporadas: number | null; numEpisodios: number | null; anioInicio: number | null } | null;
  detalleVideojuego: { plataformas: string[]; desarrollador: string | null; anioLanzamiento: number | null } | null;
  detalleMusica: { artista: string | null; album: string | null; duracionSeg: number | null } | null;
}): ContenidoConDetalle["detalle"] {
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
