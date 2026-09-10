import type { EstadoComparticion } from "@/domain/entities/Comparticion";

export interface BuscarUsuariosDto {
  q: string;
}

export interface UsuarioBuscadoDto {
  id: string;
  nombre: string;
}

export interface CrearComparticionDto {
  contenidoId: string;
  usuarioDestinoId: string;
}

export interface ComparticionDto {
  id: string;
  contenido: {
    id: string;
    titulo: string;
    imagenUrl: string | null;
    tipo: string;
    fuenteExterna: string;
    idExterno: string;
  };
  usuarioOrigen: { id: string; nombre: string };
  usuarioDestino: { id: string; nombre: string };
  estado: EstadoComparticion;
  fechaEnvio: string;
}

export interface ListarComparticionesResponseDto {
  enviadas: ComparticionDto[];
  recibidas: ComparticionDto[];
}

export interface ResponderComparticionDto {
  accion: "aceptar" | "rechazar";
}

export interface ContenidoPublicoDto {
  id: string;
  titulo: string;
  imagenUrl: string | null;
  tipo: string;
  fuenteExterna: string;
  idExterno: string;
  detalle:
    | { _tipo: "pelicula"; duracionMin: number | null; director: string | null; anio: number | null }
    | { _tipo: "serie"; numTemporadas: number | null; numEpisodios: number | null; anioInicio: number | null }
    | { _tipo: "videojuego"; plataformas: string[]; desarrollador: string | null; anioLanzamiento: number | null }
    | { _tipo: "musica"; artista: string | null; album: string | null; duracionSeg: number | null }
    | null;
}
