export type TipoContenido = "pelicula" | "serie" | "videojuego" | "musica";
export type FuenteExterna = "tmdb" | "igdb" | "spotify";

export const TIPOS_CONTENIDO: readonly TipoContenido[] = [
  "pelicula",
  "serie",
  "videojuego",
  "musica",
] as const;

export const FUENTES_EXTERNAS: readonly FuenteExterna[] = [
  "tmdb",
  "igdb",
  "spotify",
] as const;

export interface ContenidoProps {
  id: string;
  tipo: TipoContenido;
  titulo: string;
  imagenUrl: string | null;
  fuenteExterna: FuenteExterna;
  idExterno: string;
  fechaAnadido: Date;
}

export interface DetallePeliculaProps {
  duracionMin?: number | null;
  director?: string | null;
  anio?: number | null;
}

export interface DetalleSerieProps {
  numTemporadas?: number | null;
  numEpisodios?: number | null;
  anioInicio?: number | null;
}

export interface DetalleVideojuegoProps {
  plataformas?: string[];
  desarrollador?: string | null;
  anioLanzamiento?: number | null;
}

export interface DetalleMusicaProps {
  artista?: string | null;
  album?: string | null;
  duracionSeg?: number | null;
}

export type DetalleProps =
  | DetallePeliculaProps
  | DetalleSerieProps
  | DetalleVideojuegoProps
  | DetalleMusicaProps;

export class Contenido {
  readonly id: string;
  readonly tipo: TipoContenido;
  readonly titulo: string;
  readonly imagenUrl: string | null;
  readonly fuenteExterna: FuenteExterna;
  readonly idExterno: string;
  readonly fechaAnadido: Date;

  constructor(props: ContenidoProps) {
    this.id = props.id;
    this.tipo = props.tipo;
    this.titulo = props.titulo;
    this.imagenUrl = props.imagenUrl;
    this.fuenteExterna = props.fuenteExterna;
    this.idExterno = props.idExterno;
    this.fechaAnadido = props.fechaAnadido;
  }

  static validateTipo(tipo: string): void {
    if (!(TIPOS_CONTENIDO as readonly string[]).includes(tipo)) {
      throw new Error(`Tipo no válido: ${tipo}`);
    }
  }

  static validateFuente(fuente: string): void {
    if (!(FUENTES_EXTERNAS as readonly string[]).includes(fuente)) {
      throw new Error(`Fuente externa no válida: ${fuente}`);
    }
  }

  static validateTitulo(titulo: string): void {
    if (!titulo || titulo.trim().length === 0) {
      throw new Error("El título es obligatorio");
    }
    if (titulo.length > 255) {
      throw new Error("El título no puede superar 255 caracteres");
    }
  }

  static validateIdExterno(idExterno: string): void {
    if (!idExterno || idExterno.trim().length === 0) {
      throw new Error("idExterno es obligatorio");
    }
    if (idExterno.length > 100) {
      throw new Error("idExterno no puede superar 100 caracteres");
    }
  }

  static validateImagenUrl(imagenUrl: string | null | undefined): void {
    if (imagenUrl != null && imagenUrl.length > 2048) {
      throw new Error("imagenUrl demasiado larga");
    }
  }
}

export interface ContenidoConDetalle extends ContenidoProps {
  detalle:
    | (DetallePeliculaProps & { _tipo: "pelicula" })
    | (DetalleSerieProps & { _tipo: "serie" })
    | (DetalleVideojuegoProps & { _tipo: "videojuego" })
    | (DetalleMusicaProps & { _tipo: "musica" })
    | null;
}

export type EstadoContenido = "pendiente" | "en_proceso" | "visto";

export interface ContenidoConEstado extends ContenidoProps {
  detalle: ContenidoConDetalle["detalle"];
  estadoUsuario: EstadoContenido | null;
}
