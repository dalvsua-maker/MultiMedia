export type EstadoComparticion = "pendiente" | "aceptada" | "rechazada";

export interface ComparticionProps {
  id: string;
  contenidoId: string;
  usuarioOrigenId: string;
  usuarioDestinoId: string;
  estado: EstadoComparticion;
  fechaEnvio: Date;
}

export class Comparticion {
  readonly id: string;
  readonly contenidoId: string;
  readonly usuarioOrigenId: string;
  readonly usuarioDestinoId: string;
  readonly estado: EstadoComparticion;
  readonly fechaEnvio: Date;

  constructor(props: ComparticionProps) {
    this.id = props.id;
    this.contenidoId = props.contenidoId;
    this.usuarioOrigenId = props.usuarioOrigenId;
    this.usuarioDestinoId = props.usuarioDestinoId;
    this.estado = props.estado;
    this.fechaEnvio = props.fechaEnvio;
  }

  static validateNoAutoCompartir(origen: string, destino: string): void {
    if (origen === destino) {
      throw new Error("No puedes compartir contenido contigo mismo");
    }
  }

  static isEstadoValido(v: string): v is EstadoComparticion {
    return ["pendiente", "aceptada", "rechazada"].includes(v);
  }

  canResponder(): boolean {
    return this.estado === "pendiente";
  }
}
