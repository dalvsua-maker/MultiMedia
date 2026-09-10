import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import type { IRecomendacionService } from "@/domain/services/IRecomendacionService";
import type { ContenidoConDetalle } from "@/domain/entities/Contenido";
import type { TipoContenido, FuenteExterna } from "@/domain/entities/Contenido";

type TipoCount = { tipo: TipoContenido; count: number };
type RawRow = {
  id: string;
  tipo: string;
  titulo: string;
  imagen_url: string | null;
  fuente_externa: string;
  id_externo: string;
  fecha_anadido: Date;
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

const LIMIT = 10;

export class RecomendacionServiceV1 implements IRecomendacionService {
  async recomendar(usuarioId: string): Promise<ContenidoConDetalle[]> {
    const afinidad: TipoCount[] = await prisma.$queryRaw`
      SELECT c.tipo as tipo, COUNT(*)::int as count
      FROM usuario_contenido uc
      JOIN contenidos c ON c.id = uc.contenido_id
      WHERE uc.usuario_id = ${usuarioId}::uuid
      GROUP BY c.tipo
      ORDER BY count DESC, c.tipo ASC
    `;

    const topTipo: TipoContenido | null =
      afinidad.length > 0 ? afinidad[0].tipo : null;

    const acumulado: ContenidoConDetalle[] = [];
    const excluidos = new Set<string>();

    const agregar = (rows: RawRow[]) => {
      for (const r of rows) {
        if (!excluidos.has(r.id)) {
          excluidos.add(r.id);
          acumulado.push(mapRow(r));
        }
      }
    };

    if (topTipo) {
      const pasoA = await this.queryPopulares(usuarioId, [topTipo]);
      agregar(pasoA);
    }

    if (acumulado.length < LIMIT) {
      const pasoB = await this.queryPopulares(usuarioId, null);
      agregar(pasoB);
    }

    if (acumulado.length < LIMIT && topTipo) {
      const pasoC1 = await this.queryRecientesNoPoseidos(
        usuarioId,
        Array.from(excluidos),
        [topTipo]
      );
      agregar(pasoC1);
    }

    if (acumulado.length < LIMIT) {
      const pasoC2 = await this.queryRecientesNoPoseidos(
        usuarioId,
        Array.from(excluidos),
        null
      );
      agregar(pasoC2);
    }

    return acumulado.slice(0, LIMIT);
  }

  private async queryPopulares(
    usuarioId: string,
    tipos: TipoContenido[] | null
  ): Promise<RawRow[]> {
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
    const subqueryPop = `
      (
        SELECT contenido_id, COUNT(*) as pop
        FROM usuario_contenido
        GROUP BY contenido_id
      ) p
    `;

    if (tipos) {
      return prisma.$queryRaw<RawRow[]>`
        SELECT
          c.id, c.tipo, c.titulo, c.imagen_url, c.fuente_externa, c.id_externo, c.fecha_anadido,
          ${raw(columnasDetalle)}
        FROM contenidos c
        JOIN ${raw(subqueryPop)} ON p.contenido_id = c.id
        ${raw(joinsDetalle)}
        WHERE c.tipo = ANY(${tipos}::"TipoContenido"[])
          AND NOT EXISTS (
            SELECT 1 FROM usuario_contenido uc
            WHERE uc.usuario_id = ${usuarioId}::uuid AND uc.contenido_id = c.id
          )
        ORDER BY p.pop DESC, c.fecha_anadido DESC
        LIMIT ${LIMIT}
      `;
    }

    return prisma.$queryRaw<RawRow[]>`
      SELECT
        c.id, c.tipo, c.titulo, c.imagen_url, c.fuente_externa, c.id_externo, c.fecha_anadido,
        ${raw(columnasDetalle)}
      FROM contenidos c
      JOIN ${raw(subqueryPop)} ON p.contenido_id = c.id
      ${raw(joinsDetalle)}
      WHERE NOT EXISTS (
          SELECT 1 FROM usuario_contenido uc
          WHERE uc.usuario_id = ${usuarioId}::uuid AND uc.contenido_id = c.id
        )
      ORDER BY p.pop DESC, c.fecha_anadido DESC
      LIMIT ${LIMIT}
    `;
  }

  private async queryRecientesNoPoseidos(
    usuarioId: string,
    excludeIds: string[],
    tipos: TipoContenido[] | null
  ): Promise<RawRow[]> {
    const restantes = LIMIT - excludeIds.length;
    if (restantes <= 0) return [];
    const hayExclude = excludeIds.length > 0;

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
    const subqueryPop = `
      (
        SELECT contenido_id, COUNT(*) as pop
        FROM usuario_contenido
        GROUP BY contenido_id
      ) p
    `;

    if (tipos && hayExclude) {
      return prisma.$queryRaw<RawRow[]>`
        SELECT
          c.id, c.tipo, c.titulo, c.imagen_url, c.fuente_externa, c.id_externo, c.fecha_anadido,
          ${raw(columnasDetalle)}
        FROM contenidos c
        LEFT JOIN ${raw(subqueryPop)} ON p.contenido_id = c.id
        ${raw(joinsDetalle)}
        WHERE c.tipo = ANY(${tipos}::"TipoContenido"[])
          AND NOT EXISTS (
            SELECT 1 FROM usuario_contenido uc
            WHERE uc.usuario_id = ${usuarioId}::uuid AND uc.contenido_id = c.id
          )
          AND c.id <> ALL(${excludeIds}::uuid[])
        ORDER BY COALESCE(p.pop, 0) DESC, c.fecha_anadido DESC
        LIMIT ${restantes}
      `;
    }

    if (tipos && !hayExclude) {
      return prisma.$queryRaw<RawRow[]>`
        SELECT
          c.id, c.tipo, c.titulo, c.imagen_url, c.fuente_externa, c.id_externo, c.fecha_anadido,
          ${raw(columnasDetalle)}
        FROM contenidos c
        LEFT JOIN ${raw(subqueryPop)} ON p.contenido_id = c.id
        ${raw(joinsDetalle)}
        WHERE c.tipo = ANY(${tipos}::"TipoContenido"[])
          AND NOT EXISTS (
            SELECT 1 FROM usuario_contenido uc
            WHERE uc.usuario_id = ${usuarioId}::uuid AND uc.contenido_id = c.id
          )
        ORDER BY COALESCE(p.pop, 0) DESC, c.fecha_anadido DESC
        LIMIT ${restantes}
      `;
    }

    if (!tipos && hayExclude) {
      return prisma.$queryRaw<RawRow[]>`
        SELECT
          c.id, c.tipo, c.titulo, c.imagen_url, c.fuente_externa, c.id_externo, c.fecha_anadido,
          ${raw(columnasDetalle)}
        FROM contenidos c
        LEFT JOIN ${raw(subqueryPop)} ON p.contenido_id = c.id
        ${raw(joinsDetalle)}
        WHERE NOT EXISTS (
            SELECT 1 FROM usuario_contenido uc
            WHERE uc.usuario_id = ${usuarioId}::uuid AND uc.contenido_id = c.id
          )
          AND c.id <> ALL(${excludeIds}::uuid[])
        ORDER BY COALESCE(p.pop, 0) DESC, c.fecha_anadido DESC
        LIMIT ${restantes}
      `;
    }

    return prisma.$queryRaw<RawRow[]>`
      SELECT
        c.id, c.tipo, c.titulo, c.imagen_url, c.fuente_externa, c.id_externo, c.fecha_anadido,
        ${raw(columnasDetalle)}
      FROM contenidos c
      LEFT JOIN ${raw(subqueryPop)} ON p.contenido_id = c.id
      ${raw(joinsDetalle)}
      WHERE NOT EXISTS (
          SELECT 1 FROM usuario_contenido uc
          WHERE uc.usuario_id = ${usuarioId}::uuid AND uc.contenido_id = c.id
        )
      ORDER BY COALESCE(p.pop, 0) DESC, c.fecha_anadido DESC
      LIMIT ${restantes}
    `;
  }
}

function raw(sql: string): Prisma.Sql {
  return Prisma.raw(sql);
}

function mapRow(r: RawRow): ContenidoConDetalle {
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
