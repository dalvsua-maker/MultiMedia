import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import type { ContenidoConDetalle } from "@/domain/entities/Contenido";
import type { TipoContenido, FuenteExterna } from "@/domain/entities/Contenido";

type RawRowV2 = {
  id: string;
  tipo: string;
  titulo: string;
  imagen_url: string | null;
  fuente_externa: string;
  id_externo: string;
  fecha_anadido: Date;
  ya_anadido: boolean;
  detalle_pelicula_duracion: number | null;
  detalle_pelicula_director: string | null;
  detalle_pelicula_anio: number | null;
  detalle_serie_temporadas: number | null;
  detalle_serie_episodios: number | null;
  detalle_serie_anio: number | null;
  detalle_videojuego_plataformas: string[] | null;
  detalle_videojuego_desarrollador: string | null;
  detalle_videojuego_anio: number | null;
  detalle_musica_artista: string | null;
  detalle_musica_album: string | null;
  detalle_musica_duracion: number | null;
};

export type ContenidoConYaAnadido = ContenidoConDetalle & { yaAnadido: boolean };
export type RecomendacionesPorTipo = Record<TipoContenido, ContenidoConYaAnadido[]>;

const TIPOS: TipoContenido[] = ["pelicula", "serie", "videojuego", "musica"];
const LIMIT_POR_TIPO = 4;
const POOL_TOP = 50;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class RecomendacionServiceV2 {
  async recomendar(usuarioId: string): Promise<ContenidoConDetalle[]> {
    const agrupado = await this.recomendarAgrupado(usuarioId);
    return TIPOS.flatMap((t) => agrupado[t]);
  }

  async recomendarAgrupado(usuarioId: string): Promise<RecomendacionesPorTipo> {
    // Afinidad: qué tipo consume más el usuario (sigue siendo señal legítima)
    const afinidad: Array<{ tipo: TipoContenido; count: number }> = await prisma.$queryRaw`
      SELECT c.tipo as tipo, COUNT(*)::int as count
      FROM usuario_contenido uc
      JOIN contenidos c ON c.id = uc.contenido_id
      WHERE uc.usuario_id = ${usuarioId}::uuid
      GROUP BY c.tipo
      ORDER BY count DESC, c.tipo ASC
    `;

    // Ordenar tipos por afinidad (más consumido primero), resto en orden fijo
    const ordenTipos: TipoContenido[] = [...TIPOS].sort((a, b) => {
      const ca = afinidad.find((x) => x.tipo === a)?.count ?? 0;
      const cb = afinidad.find((x) => x.tipo === b)?.count ?? 0;
      if (cb !== ca) return cb - ca;
      return a.localeCompare(b);
    });

    const result: RecomendacionesPorTipo = {
      pelicula: [],
      serie: [],
      videojuego: [],
      musica: [],
    };

    const globalExcluidos = new Set<string>();

    for (const tipo of ordenTipos) {
      const pool = await this.fetchTopPorPopularidad(usuarioId, tipo, Array.from(globalExcluidos), POOL_TOP);
      const shuffled = shuffle(pool).slice(0, LIMIT_POR_TIPO);
      let seleccionados = shuffled;

      // Fallback: si aún faltan (<4) por exclusiones, completar con recientes por popularidad (menos restrictivo)
      if (seleccionados.length < LIMIT_POR_TIPO) {
        const faltan = LIMIT_POR_TIPO - seleccionados.length;
        const extra = await this.fetchTopPorPopularidad(
          usuarioId,
          tipo,
          Array.from(globalExcluidos).concat(seleccionados.map((r) => r.id)),
          POOL_TOP
        );
        // filtrar los ya seleccionados
        const filtrados = extra.filter((r) => !seleccionados.some((s) => s.id === r.id));
        const shuffledExtra = shuffle(filtrados).slice(0, faltan);
        seleccionados = [...seleccionados, ...shuffledExtra];
      }

      const mapped = seleccionados.map((r) => ({ ...mapRow(r), yaAnadido: r.ya_anadido }));
      for (const m of mapped) globalExcluidos.add(m.id);
      result[tipo] = mapped;
    }

    // Asegurar que todos los tipos existan en orden original TIPOS para el DTO (aunque orden interno sea por afinidad)
    // El frontend itera en orden pelicula/serie/videojuego/musica, así que mantenemos ese orden
    return result;
  }

  private async fetchTopPorPopularidad(
    usuarioId: string,
    tipo: TipoContenido,
    excludeIds: string[],
    limit: number
  ): Promise<RawRowV2[]> {
    const columnasDetalle = `
      dp.duracion_min as detalle_pelicula_duracion,
      dp.director as detalle_pelicula_director,
      dp.anio as detalle_pelicula_anio,
      ds.num_temporadas as detalle_serie_temporadas,
      ds.num_episodios as detalle_serie_episodios,
      ds.anio_inicio as detalle_serie_anio,
      dv.plataformas as detalle_videojuego_plataformas,
      dv.desarrollador as detalle_videojuego_desarrollador,
      dv.anio_lanzamiento as detalle_videojuego_anio,
      dm.artista as detalle_musica_artista,
      dm.album as detalle_musica_album,
      dm.duracion_seg as detalle_musica_duracion
    `;
    const joinsDetalle = `
      LEFT JOIN detalle_peliculas dp ON dp.contenido_id = c.id
      LEFT JOIN detalle_series ds ON ds.contenido_id = c.id
      LEFT JOIN detalle_videojuegos dv ON dv.contenido_id = c.id
      LEFT JOIN detalle_musica dm ON dm.contenido_id = c.id
    `;
    const hayExclude = excludeIds.length > 0;

    if (hayExclude) {
      return prisma.$queryRaw<RawRowV2[]>`
        SELECT
          c.id, c.tipo, c.titulo, c.imagen_url, c.fuente_externa, c.id_externo, c.fecha_anadido,
          CASE WHEN h.usuario_id IS NOT NULL THEN true ELSE false END as ya_anadido,
          ${Prisma.raw(columnasDetalle)}
        FROM contenidos c
        LEFT JOIN historial_usuario_contenido h ON h.usuario_id = ${usuarioId}::uuid AND h.contenido_id = c.id
        ${Prisma.raw(joinsDetalle)}
        WHERE c.tipo = ${tipo}::"TipoContenido"
          AND NOT EXISTS (
            SELECT 1 FROM usuario_contenido uc
            WHERE uc.usuario_id = ${usuarioId}::uuid AND uc.contenido_id = c.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM recomendacion_feedback rf
            WHERE rf.usuario_id = ${usuarioId}::uuid AND rf.contenido_id = c.id AND rf.voto IN ('no_me_gusta','ya_lo_vi')
          )
          AND c.id <> ALL(${excludeIds}::uuid[])
        ORDER BY c.popularidad_externa DESC NULLS LAST, c.fecha_anadido DESC
        LIMIT ${limit}
      `;
    }

    return prisma.$queryRaw<RawRowV2[]>`
      SELECT
        c.id, c.tipo, c.titulo, c.imagen_url, c.fuente_externa, c.id_externo, c.fecha_anadido,
        CASE WHEN h.usuario_id IS NOT NULL THEN true ELSE false END as ya_anadido,
        ${Prisma.raw(columnasDetalle)}
      FROM contenidos c
      LEFT JOIN historial_usuario_contenido h ON h.usuario_id = ${usuarioId}::uuid AND h.contenido_id = c.id
      ${Prisma.raw(joinsDetalle)}
      WHERE c.tipo = ${tipo}::"TipoContenido"
        AND NOT EXISTS (
          SELECT 1 FROM usuario_contenido uc
          WHERE uc.usuario_id = ${usuarioId}::uuid AND uc.contenido_id = c.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM recomendacion_feedback rf
          WHERE rf.usuario_id = ${usuarioId}::uuid AND rf.contenido_id = c.id AND rf.voto IN ('no_me_gusta','ya_lo_vi')
        )
      ORDER BY c.popularidad_externa DESC NULLS LAST, c.fecha_anadido DESC
      LIMIT ${limit}
    `;
  }
}

function mapRow(r: RawRowV2): ContenidoConDetalle {
  return {
    id: r.id,
    tipo: r.tipo as TipoContenido,
    titulo: r.titulo,
    imagenUrl: r.imagen_url,
    fuenteExterna: r.fuente_externa as FuenteExterna,
    idExterno: r.id_externo,
    fechaAnadido: r.fecha_anadido,
    detalle: mapDetalleFromRow(r),
  };
}

function mapDetalleFromRow(row: {
  tipo: string;
  detalle_pelicula_duracion: number | null;
  detalle_pelicula_director: string | null;
  detalle_pelicula_anio: number | null;
  detalle_serie_temporadas: number | null;
  detalle_serie_episodios: number | null;
  detalle_serie_anio: number | null;
  detalle_videojuego_plataformas: string[] | null;
  detalle_videojuego_desarrollador: string | null;
  detalle_videojuego_anio: number | null;
  detalle_musica_artista: string | null;
  detalle_musica_album: string | null;
  detalle_musica_duracion: number | null;
}): ContenidoConDetalle["detalle"] {
  switch (row.tipo) {
    case "pelicula":
      return row.detalle_pelicula_duracion !== null ||
        row.detalle_pelicula_director !== null ||
        row.detalle_pelicula_anio !== null
        ? {
            _tipo: "pelicula",
            duracionMin: row.detalle_pelicula_duracion,
            director: row.detalle_pelicula_director,
            anio: row.detalle_pelicula_anio,
          }
        : null;
    case "serie":
      return row.detalle_serie_temporadas !== null ||
        row.detalle_serie_episodios !== null ||
        row.detalle_serie_anio !== null
        ? {
            _tipo: "serie",
            numTemporadas: row.detalle_serie_temporadas,
            numEpisodios: row.detalle_serie_episodios,
            anioInicio: row.detalle_serie_anio,
          }
        : null;
    case "videojuego":
      return row.detalle_videojuego_plataformas !== null ||
        row.detalle_videojuego_desarrollador !== null ||
        row.detalle_videojuego_anio !== null
        ? {
            _tipo: "videojuego",
            plataformas: row.detalle_videojuego_plataformas ?? [],
            desarrollador: row.detalle_videojuego_desarrollador,
            anioLanzamiento: row.detalle_videojuego_anio,
          }
        : null;
    case "musica":
      return row.detalle_musica_artista !== null ||
        row.detalle_musica_album !== null ||
        row.detalle_musica_duracion !== null
        ? {
            _tipo: "musica",
            artista: row.detalle_musica_artista,
            album: row.detalle_musica_album,
            duracionSeg: row.detalle_musica_duracion,
          }
        : null;
    default:
      return null;
  }
}
