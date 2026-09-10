import { IExternalSearchService } from "@/domain/services/IExternalSearchService";
import {
  TipoBusqueda,
  isTipoBusqueda,
  RespuestaBusquedaDto,
  FuenteBusqueda,
} from "@/application/dtos/BusquedaDto";
import { ValidationError } from "@/application/errors/AppError";

const FUENTE_POR_TIPO: Record<TipoBusqueda, FuenteBusqueda> = {
  pelicula: "tmdb",
  serie: "tmdb",
  videojuego: "igdb",
  musica: "spotify",
};

export class BuscarContenidoUseCase {
  constructor(private readonly external: IExternalSearchService) {}

  async execute(
    tipoRaw: string,
    qRaw: string
  ): Promise<RespuestaBusquedaDto> {
    const tipo = (tipoRaw ?? "").trim() as TipoBusqueda;
    const q = (qRaw ?? "").trim();

    if (!tipo || !isTipoBusqueda(tipo)) {
      throw new ValidationError(
        `tipo es obligatorio y debe ser uno de: pelicula, serie, videojuego, musica`
      );
    }
    if (!q || q.length < 2) {
      throw new ValidationError("q es obligatorio y debe tener al menos 2 caracteres");
    }

    const resultados = await this.external.search(tipo, q);

    // Limite 10 ya garantizado por adapters, pero aseguramos
    const limitados = resultados.slice(0, 10);

    return {
      resultados: limitados,
      total: limitados.length,
      fuente: FUENTE_POR_TIPO[tipo],
    };
  }
}
