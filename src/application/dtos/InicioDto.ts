import type { ContenidoDto } from "@/application/dtos/ContenidoDto";
import type { EstadoContenido } from "@/domain/entities/Contenido";

export interface InicioEnProcesoDto {
  contenido: ContenidoDto;
  estado: EstadoContenido;
  fechaActualizacion: string;
}

export interface InicioResponseDto {
  enProceso: InicioEnProcesoDto[];
  recomendaciones: ContenidoDto[];
  recomendacionesPorTipo: Record<string, (ContenidoDto & { yaAnadido: boolean })[]>;
}
