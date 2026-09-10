import type { EstadoContenido } from "@/domain/entities/Contenido";
import type { ContenidoConDetalle } from "@/domain/entities/Contenido";

export interface UsuarioContenidoConDetalles {
  contenido: ContenidoConDetalle;
  estado: EstadoContenido;
  fechaActualizacion: Date;
}

export interface IUsuarioContenidoRepository {
  find(
    usuarioId: string,
    contenidoId: string
  ): Promise<{ estado: EstadoContenido; fechaActualizacion: Date } | null>;

  exists(usuarioId: string, contenidoId: string): Promise<boolean>;

  create(
    usuarioId: string,
    contenidoId: string,
    estado?: EstadoContenido
  ): Promise<void>;

  findAllByUsuarioId(usuarioId: string): Promise<UsuarioContenidoConDetalles[]>;

  updateEstado(
    usuarioId: string,
    contenidoId: string,
    estado: EstadoContenido
  ): Promise<void>;
}
