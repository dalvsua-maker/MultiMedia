import {
  Contenido,
  ContenidoConDetalle,
  DetalleProps,
  TipoContenido,
  FuenteExterna,
} from "@/domain/entities/Contenido";

export interface CrearContenidoData {
  tipo: TipoContenido;
  titulo: string;
  imagenUrl?: string | null;
  fuenteExterna: FuenteExterna;
  idExterno: string;
  detalle?: DetalleProps | null;
}

export interface IContenidoRepository {
  findByFuenteExternaAndIdExterno(
    fuenteExterna: FuenteExterna,
    idExterno: string
  ): Promise<Contenido | null>;

  findById(id: string): Promise<Contenido | null>;

  findByIdConDetalle(id: string): Promise<ContenidoConDetalle | null>;

  create(data: CrearContenidoData): Promise<Contenido>;

  findByIdConDetalleYEstado(
    contenidoId: string,
    usuarioId: string
  ): Promise<ContenidoConDetalle & { estadoUsuario: string | null } | null>;
}
