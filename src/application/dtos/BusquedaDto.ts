export type TipoBusqueda = "pelicula" | "serie" | "videojuego" | "musica";

export const TIPOS_BUSQUEDA: readonly TipoBusqueda[] = [
  "pelicula",
  "serie",
  "videojuego",
  "musica",
] as const;

export function isTipoBusqueda(v: string): v is TipoBusqueda {
  return (TIPOS_BUSQUEDA as readonly string[]).includes(v);
}

export type FuenteBusqueda = "tmdb" | "igdb" | "spotify";

export interface ResultadoBusqueda {
  fuenteExterna: FuenteBusqueda;
  idExterno: string;
  tipo: TipoBusqueda;
  titulo: string;
  imagenUrl: string | null;
  metadatos: Record<string, unknown>;
}

export interface BuscarContenidoDto {
  tipo: TipoBusqueda;
  q: string;
}

export interface RespuestaBusquedaDto {
  resultados: ResultadoBusqueda[];
  total: number;
  fuente: FuenteBusqueda;
}
