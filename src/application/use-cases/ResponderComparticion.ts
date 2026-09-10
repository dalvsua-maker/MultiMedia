import { IComparticionRepository } from "@/domain/repositories/IComparticionRepository";
import { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from "@/application/errors/AppError";
import type { ComparticionDto } from "@/application/dtos/ComparticionDto";

export interface ResponderComparticionResult {
  comparticion: ComparticionDto;
  yaExistia: boolean;
}

export class ResponderComparticionUseCase {
  constructor(
    private readonly comparticionRepo: IComparticionRepository,
    private readonly usuarioContenidoRepo: IUsuarioContenidoRepository
  ) {}

  async execute(
    usuarioId: string,
    comparticionId: string,
    accion: string
  ): Promise<ResponderComparticionResult> {
    if (!usuarioId) throw new UnauthorizedError("Usuario no autenticado");
    if (!comparticionId) throw new ValidationError("comparticionId es obligatorio");
    if (accion !== "aceptar" && accion !== "rechazar") {
      throw new ValidationError('accion debe ser "aceptar" | "rechazar"');
    }

    const comp = await this.comparticionRepo.findById(comparticionId);
    if (!comp) throw new NotFoundError("Compartición no encontrada");

    if (comp.usuarioDestinoId !== usuarioId) {
      throw new ForbiddenError("No puedes responder una compartición que no es tuya");
    }

    if (comp.estado !== "pendiente") {
      throw new ConflictError("La compartición ya fue respondida");
    }

    let yaExistia = false;

    if (accion === "rechazar") {
      const updated = await this.comparticionRepo.updateEstado(comparticionId, "rechazada");
      const conDetalles = await this.comparticionRepo.findByIdConDetalles(updated.id);
      if (!conDetalles) throw new NotFoundError("Compartición no encontrada");
      return {
        comparticion: {
          id: conDetalles.id,
          contenido: conDetalles.contenido,
          usuarioOrigen: conDetalles.usuarioOrigen,
          usuarioDestino: conDetalles.usuarioDestino,
          estado: conDetalles.estado,
          fechaEnvio: conDetalles.fechaEnvio.toISOString(),
        },
        yaExistia: false,
      };
    }

    // aceptar
    yaExistia = await this.usuarioContenidoRepo.exists(usuarioId, comp.contenidoId);
    if (!yaExistia) {
      await this.usuarioContenidoRepo.create(usuarioId, comp.contenidoId, "pendiente");
    }

    const updated = await this.comparticionRepo.updateEstado(comparticionId, "aceptada");
    const conDetalles = await this.comparticionRepo.findByIdConDetalles(updated.id);
    if (!conDetalles) throw new NotFoundError("Compartición no encontrada");
    return {
      comparticion: {
        id: conDetalles.id,
        contenido: conDetalles.contenido,
        usuarioOrigen: conDetalles.usuarioOrigen,
        usuarioDestino: conDetalles.usuarioDestino,
        estado: conDetalles.estado,
        fechaEnvio: conDetalles.fechaEnvio.toISOString(),
      },
      yaExistia,
    };
  }
}
