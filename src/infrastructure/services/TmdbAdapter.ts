import { IExternalSearchService } from "@/domain/services/IExternalSearchService";
import {
  ResultadoBusqueda,
  TipoBusqueda,
} from "@/application/dtos/BusquedaDto";
import { ValidationError } from "@/application/errors/AppError";
import { assertOk, fetchWithTimeout } from "@/infrastructure/services/fetchWithTimeout";

function getTmdbKey(): string {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new ValidationError("TMDB_API_KEY no configurada");
  return key;
}

interface TmdbMovie {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  overview: string;
}

interface TmdbTv {
  id: number;
  name: string;
  poster_path: string | null;
  first_air_date: string;
  overview: string;
}

const TMDB_BASE = "https://api.themoviedb.org/3";

function mapMovie(m: TmdbMovie): ResultadoBusqueda {
  return {
    fuenteExterna: "tmdb",
    idExterno: String(m.id),
    tipo: "pelicula",
    titulo: m.title,
    imagenUrl: m.poster_path
      ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
      : null,
    metadatos: {
      fecha: m.release_date,
      overview: m.overview,
    },
  };
}

function mapTv(t: TmdbTv): ResultadoBusqueda {
  return {
    fuenteExterna: "tmdb",
    idExterno: String(t.id),
    tipo: "serie",
    titulo: t.name,
    imagenUrl: t.poster_path
      ? `https://image.tmdb.org/t/p/w500${t.poster_path}`
      : null,
    metadatos: {
      fecha: t.first_air_date,
      overview: t.overview,
    },
  };
}

export class TmdbAdapter implements IExternalSearchService {
  async search(tipo: TipoBusqueda, q: string): Promise<ResultadoBusqueda[]> {
    if (tipo !== "pelicula" && tipo !== "serie") {
      throw new ValidationError(`TmdbAdapter no soporta tipo ${tipo}`);
    }
    const key = getTmdbKey();
    const endpoint = tipo === "pelicula" ? "movie" : "tv";
    const url = `${TMDB_BASE}/search/${endpoint}?query=${encodeURIComponent(
      q
    )}&language=es-ES&page=1`;

    const res = await fetchWithTimeout(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      timeoutMs: 5000,
    });
    assertOk(res, "TMDB");

    const data = (await res.json()) as {
      results?: unknown[];
    };
    const results = (data.results ?? []).slice(0, 10) as
      | TmdbMovie[]
      | TmdbTv[];

    if (tipo === "pelicula") {
      return (results as TmdbMovie[]).map(mapMovie);
    }
    return (results as TmdbTv[]).map(mapTv);
  }
}
