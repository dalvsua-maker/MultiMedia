import { IExternalSearchService } from "@/domain/services/IExternalSearchService";
import {
  ResultadoBusqueda,
  TipoBusqueda,
} from "@/application/dtos/BusquedaDto";
import { ValidationError } from "@/application/errors/AppError";
import { TmdbAdapter } from "@/infrastructure/services/TmdbAdapter";
import { IgdbAdapter } from "@/infrastructure/services/IgdbAdapter";
import { SpotifyAdapter } from "@/infrastructure/services/SpotifyAdapter";

export class ExternalSearchService implements IExternalSearchService {
  private readonly tmdb = new TmdbAdapter();
  private readonly igdb = new IgdbAdapter();
  private readonly spotify = new SpotifyAdapter();

  async search(tipo: TipoBusqueda, q: string): Promise<ResultadoBusqueda[]> {
    switch (tipo) {
      case "pelicula":
      case "serie":
        return this.tmdb.search(tipo, q);
      case "videojuego":
        return this.igdb.search(tipo, q);
      case "musica":
        return this.spotify.search(tipo, q);
      default:
        throw new ValidationError(`Tipo no soportado: ${tipo}`);
    }
  }
}
