import type {
  TipoContenido,
  FuenteExterna,
  DetallePeliculaProps,
  DetalleSerieProps,
  DetalleVideojuegoProps,
  DetalleMusicaProps,
  EstadoContenido,
} from "@/domain/entities/Contenido";

export interface CrearContenidoDto {
  tipo: TipoContenido;
  titulo: string;
  imagenUrl?: string | null;
  fuenteExterna: FuenteExterna;
  idExterno: string;
  detalle?: DetallePeliculaProps | DetalleSerieProps | DetalleVideojuegoProps | DetalleMusicaProps | null;
  listaId?: string | null;
}

export interface ContenidoDto {
  id: string;
  tipo: TipoContenido;
  titulo: string;
  imagenUrl: string | null;
  fuenteExterna: FuenteExterna;
  idExterno: string;
  fechaAnadido: string;
  detalle:
    | (DetallePeliculaProps & { _tipo: "pelicula" })
    | (DetalleSerieProps & { _tipo: "serie" })
    | (DetalleVideojuegoProps & { _tipo: "videojuego" })
    | (DetalleMusicaProps & { _tipo: "musica" })
    | null;
}

export interface CrearContenidoResponseDto {
  contenido: ContenidoDto;
  estadoUsuario: EstadoContenido;
  yaExistia: boolean;
}

export interface ObtenerContenidoDetalleResponseDto {
  contenido: ContenidoDto;
  estadoUsuario: EstadoContenido | null;
}
