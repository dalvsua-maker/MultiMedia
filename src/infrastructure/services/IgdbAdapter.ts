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

function getIgdbCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;
  if (!clientId) throw new ValidationError("IGDB_CLIENT_ID no configurada");
  if (!clientSecret)
    throw new ValidationError("IGDB_CLIENT_SECRET no configurada");
  return { clientId, clientSecret };
}

// Cache en memoria para token Twitch (client_credentials)
let twitchToken: string | null = null;
let twitchExpiry = 0;

async function getTwitchToken(): Promise<string> {
  const now = Date.now();
  if (twitchToken && now < twitchExpiry - 60_000) return twitchToken;

  const { clientId, clientSecret } = getIgdbCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetchWithTimeout(
    `https://id.twitch.tv/oauth2/token?${params.toString()}`,
    {
      method: "POST",
      timeoutMs: 5000,
    }
  );
  assertOk(res, "Twitch OAuth");

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new ExternalServiceError("No se pudo obtener token de Twitch");
  }
  twitchToken = data.access_token;
  twitchExpiry = now + (data.expires_in ?? 3600) * 1000;
  return twitchToken;
}

interface IgdbGame {
  id: number;
  name: string;
  cover?: { url: string };
  first_release_date?: number;
  platforms?: { name: string }[];
  rating?: number;
  total_rating?: number;
}

export class IgdbAdapter implements IExternalSearchService {
  async search(tipo: TipoBusqueda, q: string): Promise<ResultadoBusqueda[]> {
    if (tipo !== "videojuego") {
      throw new ValidationError(`IgdbAdapter no soporta tipo ${tipo}`);
    }

    const { clientId } = getIgdbCreds();
    const token = await getTwitchToken();

    const body = `fields name,cover.url,first_release_date,platforms.name; search "${q.replace(
      /"/g,
      '\\"'
    )}"; limit 10;`;

    const res = await fetchWithTimeout("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "text/plain",
      },
      body,
      timeoutMs: 5000,
    });
    assertOk(res, "IGDB");

    const data = (await res.json()) as IgdbGame[];
    return data.slice(0, 10).map((g) => ({
      fuenteExterna: "igdb" as const,
      idExterno: String(g.id),
      tipo: "videojuego" as const,
      titulo: g.name,
      imagenUrl: g.cover?.url
        ? g.cover.url.startsWith("//")
          ? `https:${g.cover.url}`
          : g.cover.url
        : null,
      metadatos: {
        plataformas: g.platforms?.map((p) => p.name) ?? [],
        fecha: g.first_release_date
          ? new Date(g.first_release_date * 1000).toISOString()
          : null,
        total_rating: g.total_rating ?? g.rating ?? null,
        rating: g.rating ?? null,
      },
    }));
  }

  async obtenerPopulares(limit = 20, offset = 0): Promise<ResultadoBusqueda[]> {
    const { clientId } = getIgdbCreds();
    const token = await getTwitchToken();

    // Populares por rating total con mínimo de votos
    const body = `fields name,cover.url,first_release_date,platforms.name, rating, total_rating; where rating != null & total_rating_count > 50; sort total_rating desc; limit ${limit}; offset ${offset};`;

    const res = await fetchWithTimeout("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "text/plain",
      },
      body,
      timeoutMs: 5000,
    });
    assertOk(res, "IGDB populares");

    const data = (await res.json()) as IgdbGame[];
    return data.slice(0, limit).map((g) => ({
      fuenteExterna: "igdb" as const,
      idExterno: String(g.id),
      tipo: "videojuego" as const,
      titulo: g.name,
      imagenUrl: g.cover?.url
        ? g.cover.url.startsWith("//")
          ? `https:${g.cover.url}`
          : g.cover.url
        : null,
      metadatos: {
        plataformas: g.platforms?.map((p) => p.name) ?? [],
        fecha: g.first_release_date
          ? new Date(g.first_release_date * 1000).toISOString()
          : null,
        total_rating: g.total_rating ?? g.rating ?? null,
        rating: g.rating ?? null,
      },
    }));
  }

  // Exportado para tests: reset cache
  static _resetCache() {
    twitchToken = null;
    twitchExpiry = 0;
  }
}
