import type { EstadoContenido } from "@/domain/entities/Contenido";
import type { ContenidoDto } from "@/application/dtos/ContenidoDto";

export interface ActualizarEstadoDto {
  estado: EstadoContenido;
}

export interface UsuarioContenidoDto {
  contenido: ContenidoDto;
  estado: EstadoContenido;
  fechaActualizacion: string;
}

export interface ListarUsuarioContenidosResponseDto {
  contenidos: UsuarioContenidoDto[];
  total: number;
}
