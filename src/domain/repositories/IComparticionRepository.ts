import { Comparticion, EstadoComparticion } from "@/domain/entities/Comparticion";

export interface ComparticionConDetalles {
  id: string;
  contenidoId: string;
  usuarioOrigenId: string;
  usuarioDestinoId: string;
  estado: EstadoComparticion;
  fechaEnvio: Date;
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
}

export interface IComparticionRepository {
  create(data: {
    contenidoId: string;
    usuarioOrigenId: string;
    usuarioDestinoId: string;
  }): Promise<Comparticion>;

  findPendiente(
    usuarioOrigenId: string,
    usuarioDestinoId: string,
    contenidoId: string
  ): Promise<Comparticion | null>;

  findById(id: string): Promise<Comparticion | null>;

  findByIdConDetalles(id: string): Promise<ComparticionConDetalles | null>;

  findByUsuario(usuarioId: string): Promise<{
    enviadas: ComparticionConDetalles[];
    recibidas: ComparticionConDetalles[];
  }>;

  updateFechaEnvio(id: string, fechaEnvio: Date): Promise<Comparticion>;

  updateEstado(id: string, estado: EstadoComparticion): Promise<Comparticion>;
}
