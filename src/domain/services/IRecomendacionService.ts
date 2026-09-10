import type { ContenidoConDetalle } from "@/domain/entities/Contenido";

export interface IRecomendacionService {
  recomendar(usuarioId: string): Promise<ContenidoConDetalle[]>;
}
