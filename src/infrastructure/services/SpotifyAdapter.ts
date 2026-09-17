import { IExternalSearchService } from "@/domain/services/IExternalSearchService";
import {
  ResultadoBusqueda,
  TipoBusqueda,
} from "@/application/dtos/BusquedaDto";
import {
  ValidationError,
  ExternalServiceError,
} from "@/application/errors/AppError";
import { assertOk, fetchWithTimeout } from "@/infrastructure/services/fetchWithTimeout";

function getSpotifyCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId)
    throw new ValidationError("SPOTIFY_CLIENT_ID no configurada");
  if (!clientSecret)
    throw new ValidationError("SPOTIFY_CLIENT_SECRET no configurada");
  return { clientId, clientSecret };
}

let spotifyToken: string | null = null;
let spotifyExpiry = 0;

async function getSpotifyToken(): Promise<string> {
  const now = Date.now();
  if (spotifyToken && now < spotifyExpiry - 60_000) return spotifyToken;

  const { clientId, clientSecret } = getSpotifyCreds();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    timeoutMs: 5000,
  });
  assertOk(res, "Spotify OAuth");

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new ExternalServiceError("No se pudo obtener token de Spotify");
  }
  spotifyToken = data.access_token;
  spotifyExpiry = now + (data.expires_in ?? 3600) * 1000;
  return spotifyToken;
}

interface SpotifyTrack {
  id: string;
  name: string;
  album: { images: { url: string }[]; name: string };
  artists: { name: string }[];
  duration_ms: number;
  popularity: number;
}

export class SpotifyAdapter implements IExternalSearchService {
  async search(tipo: TipoBusqueda, q: string): Promise<ResultadoBusqueda[]> {
    if (tipo !== "musica") {
      throw new ValidationError(`SpotifyAdapter no soporta tipo ${tipo}`);
    }

    const token = await getSpotifyToken();

    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(
      q
    )}&type=track&limit=10`;

    const res = await fetchWithTimeout(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      timeoutMs: 5000,
    });
    assertOk(res, "Spotify");

    const data = (await res.json()) as {
      tracks?: { items: SpotifyTrack[] };
    };
    const items = data.tracks?.items ?? [];
    // Enriquecer con popularity via GET /v1/tracks (search no trae popularity con client_credentials)
    const withPop = await this.enrichWithPopularity(items.slice(0, 10), token);
    return withPop.map((t) => ({
      fuenteExterna: "spotify" as const,
      idExterno: t.id,
      tipo: "musica" as const,
      titulo: t.name,
      imagenUrl: t.album.images[0]?.url ?? null,
      metadatos: {
        artista: t.artists.map((a) => a.name).join(", "),
        album: t.album.name,
        duracionSeg: Math.round(t.duration_ms / 1000),
        popularity: t.popularity,
      },
    }));
  }

  private async enrichWithPopularity(tracks: SpotifyTrack[], token: string): Promise<SpotifyTrack[]> {
    if (tracks.length === 0) return tracks;
    const ids = tracks.map((t) => t.id).join(",");
    try {
      const url = `https://api.spotify.com/v1/tracks?ids=${encodeURIComponent(ids)}`;
      const res = await fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        timeoutMs: 5000,
      });
      if (!res.ok) return tracks;
      const data = (await res.json()) as { tracks?: SpotifyTrack[] };
      const byId = new Map((data.tracks ?? []).map((t) => [t.id, t]));
      return tracks.map((t) => byId.get(t.id) ?? t);
    } catch {
      return tracks;
    }
  }

  async obtenerPopulares(limit = 20): Promise<ResultadoBusqueda[]> {
    // Con client_credentials no se puede acceder a featured playlists (requiere user auth)
    // Fallback: búsquedas genéricas por términos populares y mezclar resultados
    const token = await getSpotifyToken();

    const queries = ["Top Hits 2025", "Global Top 50", "Viral Hits"];
    const seen = new Set<string>();
    const resultados: ResultadoBusqueda[] = [];

    for (const q of queries) {
      if (resultados.length >= limit) break;
      const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=10`;
      const res = await fetchWithTimeout(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeoutMs: 5000,
      });
      try {
        assertOk(res, "Spotify populares");
      } catch {
        continue;
      }
      const data = (await res.json()) as {
        tracks?: { items: SpotifyTrack[] };
      };
      const items = await this.enrichWithPopularity(data.tracks?.items ?? [], token);
      for (const t of items) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        resultados.push({
          fuenteExterna: "spotify" as const,
          idExterno: t.id,
          tipo: "musica" as const,
          titulo: t.name,
          imagenUrl: t.album.images[0]?.url ?? null,
          metadatos: {
            artista: t.artists.map((a) => a.name).join(", "),
            album: t.album.name,
            duracionSeg: Math.round(t.duration_ms / 1000),
            popularity: t.popularity,
          },
        });
        if (resultados.length >= limit) break;
      }
    }
    return resultados.slice(0, limit);
  }

  static _resetCache() {
    spotifyToken = null;
    spotifyExpiry = 0;
  }
}
