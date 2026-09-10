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
    return items.slice(0, 10).map((t) => ({
      fuenteExterna: "spotify" as const,
      idExterno: t.id,
      tipo: "musica" as const,
      titulo: t.name,
      imagenUrl: t.album.images[0]?.url ?? null,
      metadatos: {
        artista: t.artists.map((a) => a.name).join(", "),
        album: t.album.name,
        duracionSeg: Math.round(t.duration_ms / 1000),
      },
    }));
  }

  static _resetCache() {
    spotifyToken = null;
    spotifyExpiry = 0;
  }
}
