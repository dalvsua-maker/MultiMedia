// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import "dotenv/config";
import { prisma } from "../src/infrastructure/database/prisma";
import { TmdbAdapter } from "../src/infrastructure/services/TmdbAdapter";
import { IgdbAdapter } from "../src/infrastructure/services/IgdbAdapter";
import { SpotifyAdapter } from "../src/infrastructure/services/SpotifyAdapter";

function getPopularidad(item: { tipo: string; metadatos: Record<string, unknown> }): number | null {
  if (item.tipo === "pelicula" || item.tipo === "serie") {
    const pop = item.metadatos.popularity as number | undefined;
    const vote = item.metadatos.vote_average as number | undefined;
    if (typeof pop === "number" && pop > 0) return pop;
    if (typeof vote === "number") return vote * 10;
    return null;
  }
  if (item.tipo === "videojuego") {
    const tr = item.metadatos.total_rating as number | undefined;
    const r = item.metadatos.rating as number | undefined;
    if (typeof tr === "number") return tr;
    if (typeof r === "number") return r;
    return null;
  }
  if (item.tipo === "musica") {
    const pop = item.metadatos.popularity as number | undefined;
    if (typeof pop === "number") return pop;
    return null;
  }
  return null;
}

async function upsertContenidoReal(
  item: { fuenteExterna: string; idExterno: string; tipo: string; titulo: string; imagenUrl: string | null; metadatos: Record<string, unknown> }
) {
  const tipo = item.tipo as "pelicula" | "serie" | "videojuego" | "musica";
  const fuente = item.fuenteExterna as "tmdb" | "igdb" | "spotify";
  const popularidad = getPopularidad(item as any);
  const existing = await prisma.contenido.findUnique({
    where: { fuenteExterna_idExterno: { fuenteExterna: fuente, idExterno: item.idExterno } },
  });
  let contenidoId: string;
  if (existing) {
    // actualizar popularidad si falta
    if (existing.popularidadExterna == null && popularidad != null) {
      await prisma.contenido.update({ where: { id: existing.id }, data: { popularidadExterna: popularidad } });
    } else if (popularidad != null && existing.popularidadExterna !== popularidad) {
      // actualizar a valor más reciente si difiere mucho
      await prisma.contenido.update({ where: { id: existing.id }, data: { popularidadExterna: popularidad } });
    }
    contenidoId = existing.id;
  } else {
    const created = await prisma.contenido.create({
      data: {
        tipo,
        titulo: item.titulo,
        imagenUrl: item.imagenUrl,
        fuenteExterna: fuente,
        idExterno: item.idExterno,
        popularidadExterna: popularidad,
      },
    });
    contenidoId = created.id;

    try {
      if (tipo === "pelicula") {
        const fecha = (item.metadatos.fecha as string | null) ?? null;
        const anio = fecha ? new Date(fecha).getFullYear() : null;
        await prisma.detallePelicula.create({
          data: { contenidoId, anio: isNaN(anio as number) ? null : anio as number, director: null, duracionMin: null },
        });
      } else if (tipo === "serie") {
        const fecha = (item.metadatos.fecha as string | null) ?? null;
        const anio = fecha ? new Date(fecha).getFullYear() : null;
        await prisma.detalleSerie.create({
          data: { contenidoId, anioInicio: isNaN(anio as number) ? null : anio as number, numTemporadas: null, numEpisodios: null },
        });
      } else if (tipo === "videojuego") {
        const plataformas = (item.metadatos.plataformas as string[] | undefined) ?? [];
        const fecha = (item.metadatos.fecha as string | null) ?? null;
        const anio = fecha ? new Date(fecha).getFullYear() : null;
        await prisma.detalleVideojuego.create({
          data: { contenidoId, plataformas, desarrollador: null, anioLanzamiento: isNaN(anio as number) ? null : anio as number },
        });
      } else if (tipo === "musica") {
        const artista = (item.metadatos.artista as string | null) ?? null;
        const album = (item.metadatos.album as string | null) ?? null;
        const duracionSeg = (item.metadatos.duracionSeg as number | null) ?? null;
        await prisma.detalleMusica.create({
          data: { contenidoId, artista, album, duracionSeg },
        });
      }
    } catch (e) {
      console.warn(`Detalle fallo para ${item.titulo}:`, e);
    }
  }
  return contenidoId;
}

async function main() {
  const tmdb = new TmdbAdapter();
  const igdb = new IgdbAdapter();
  const spotify = new SpotifyAdapter();

  console.log("Fetching populares reales para ampliar a 80-100 por tipo...");

  const targetPerTipo = 90;
  const existingCounts = await prisma.contenido.groupBy({ by: ["tipo"], _count: { _all: true } });
  console.log("Antes:", existingCounts);

  const need = (tipo: string) => {
    const c = existingCounts.find((e) => e.tipo === tipo)?._count._all ?? 0;
    return Math.max(0, targetPerTipo - c);
  };

  const needPelicula = need("pelicula");
  const needSerie = need("serie");
  const needVideojuego = need("videojuego");
  const needMusica = need("musica");
  console.log(`Faltan: pelicula ${needPelicula}, serie ${needSerie}, videojuego ${needVideojuego}, musica ${needMusica}`);

  const toInsert: Array<{ fuenteExterna: string; idExterno: string; tipo: string; titulo: string; imagenUrl: string | null; metadatos: Record<string, unknown> }> = [];

  // TMDB peliculas: 5 páginas x 20 = 100
  if (needPelicula > 0) {
    const seen = new Set<string>();
    for (let page = 1; page <= 5 && toInsert.filter((x) => x.tipo === "pelicula").length < needPelicula; page++) {
      try {
        const pelis = await tmdb.obtenerPopulares("pelicula", 20, page);
        console.log(`TMDB peliculas p${page}: ${pelis.length}`);
        for (const p of pelis) {
          if (seen.has(p.idExterno)) continue;
          seen.add(p.idExterno);
          // evitar duplicados ya existentes en DB (check rápido)
          const exists = await prisma.contenido.findUnique({ where: { fuenteExterna_idExterno: { fuenteExterna: "tmdb", idExterno: p.idExterno } } });
          if (exists) continue;
          toInsert.push({ ...p, metadatos: p.metadatos as Record<string, unknown> });
          if (toInsert.filter((x) => x.tipo === "pelicula").length >= needPelicula) break;
        }
      } catch (e) {
        console.error(`TMDB peliculas p${page} error`, e);
      }
    }
  }

  // TMDB series: 5 páginas
  if (needSerie > 0) {
    const seen = new Set<string>();
    for (let page = 1; page <= 5 && toInsert.filter((x) => x.tipo === "serie").length < needSerie; page++) {
      try {
        const series = await tmdb.obtenerPopulares("serie", 20, page);
        console.log(`TMDB series p${page}: ${series.length}`);
        for (const s of series) {
          if (seen.has(s.idExterno)) continue;
          seen.add(s.idExterno);
          const exists = await prisma.contenido.findUnique({ where: { fuenteExterna_idExterno: { fuenteExterna: "tmdb", idExterno: s.idExterno } } });
          if (exists) continue;
          toInsert.push({ ...s, metadatos: s.metadatos as Record<string, unknown> });
          if (toInsert.filter((x) => x.tipo === "serie").length >= needSerie) break;
        }
      } catch (e) {
        console.error(`TMDB series p${page} error`, e);
      }
    }
  }

  // IGDB: offset pagination 0,20,40,60,80
  if (needVideojuego > 0) {
    const seen = new Set<string>();
    for (let offset = 0; offset < 100 && toInsert.filter((x) => x.tipo === "videojuego").length < needVideojuego; offset += 20) {
      try {
        const juegos = await igdb.obtenerPopulares(20, offset);
        console.log(`IGDB offset ${offset}: ${juegos.length}`);
        if (juegos.length === 0) break;
        for (const j of juegos) {
          if (seen.has(j.idExterno)) continue;
          seen.add(j.idExterno);
          const exists = await prisma.contenido.findUnique({ where: { fuenteExterna_idExterno: { fuenteExterna: "igdb", idExterno: j.idExterno } } });
          if (exists) continue;
          toInsert.push({ ...j, metadatos: j.metadatos as Record<string, unknown> });
          if (toInsert.filter((x) => x.tipo === "videojuego").length >= needVideojuego) break;
        }
      } catch (e) {
        console.error(`IGDB offset ${offset} error`, e);
      }
    }
  }

  // Spotify: múltiples queries
  if (needMusica > 0) {
    const seen = new Set<string>();
    const queries = [
      "Top Hits 2025",
      "Global Top 50",
      "Viral Hits",
      "Top 2024",
      "Reggaeton Hits",
      "Pop Hits 2025",
      "Rock Classics",
      "Hip Hop Hits",
      "Electronic Hits",
      "Indie Hits",
    ];
    for (const q of queries) {
      if (toInsert.filter((x) => x.tipo === "musica").length >= needMusica) break;
      try {
        const tracks = await spotify.search("musica", q);
        console.log(`Spotify "${q}": ${tracks.length}`);
        for (const t of tracks) {
          if (seen.has(t.idExterno)) continue;
          seen.add(t.idExterno);
          const exists = await prisma.contenido.findUnique({ where: { fuenteExterna_idExterno: { fuenteExterna: "spotify", idExterno: t.idExterno } } });
          if (exists) continue;
          toInsert.push({ ...t, metadatos: t.metadatos as Record<string, unknown> });
          if (toInsert.filter((x) => x.tipo === "musica").length >= needMusica) break;
        }
      } catch (e) {
        console.error(`Spotify q="${q}" error`, e);
      }
    }
    // fallback a obtenerPopulares si aún falta
    if (toInsert.filter((x) => x.tipo === "musica").length < needMusica) {
      try {
        const more = await spotify.obtenerPopulares(20);
        for (const t of more) {
          if (seen.has(t.idExterno)) continue;
          seen.add(t.idExterno);
          const exists = await prisma.contenido.findUnique({ where: { fuenteExterna_idExterno: { fuenteExterna: "spotify", idExterno: t.idExterno } } });
          if (exists) continue;
          toInsert.push({ ...t, metadatos: t.metadatos as Record<string, unknown> });
          if (toInsert.filter((x) => x.tipo === "musica").length >= needMusica) break;
        }
      } catch (e) {
        console.error("Spotify obtenerPopulares fallback error", e);
      }
    }
  }

  console.log(`Total a insertar: ${toInsert.length} (${toInsert.filter((x) => x.tipo === "pelicula").length} peli, ${toInsert.filter((x) => x.tipo === "serie").length} serie, ${toInsert.filter((x) => x.tipo === "videojuego").length} juego, ${toInsert.filter((x) => x.tipo === "musica").length} musica)`);

  // Backfill popularidad para existentes que aún tienen null
  const existingNull = await prisma.contenido.findMany({ where: { popularidadExterna: null }, select: { id: true, fuenteExterna: true, idExterno: true, tipo: true } });
  console.log(`Backfill popularidad para ${existingNull.length} existentes con null`);
  // Para los existentes, intentar rellenar con un valor por defecto basado en fecha o dejar null (no bloqueante)
  // Hacemos update rápido: si es tmdb, intentar mapear via cache de toInsert? Si no, dejamos null y el ranking usará COALESCE 0

  for (const item of toInsert) {
    await upsertContenidoReal(item);
  }
  console.log(`Insertados ${toInsert.length}`);

  const after = await prisma.contenido.groupBy({ by: ["tipo"], _count: { _all: true } });
  console.log("Después:", after);
  const withPop = await prisma.contenido.groupBy({ by: ["tipo"], _count: { _all: true }, where: { popularidadExterna: { not: null } } });
  console.log("Con popularidadExterna:", withPop);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });



