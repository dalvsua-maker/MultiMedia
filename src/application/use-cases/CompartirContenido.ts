import { IComparticionRepository } from "@/domain/repositories/IComparticionRepository";
import { IContenidoRepository } from "@/domain/repositories/IContenidoRepository";
import { IUsuarioRepository } from "@/domain/repositories/IUsuarioRepository";
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from "@/application/errors/AppError";
import type { ComparticionDto } from "@/application/dtos/ComparticionDto";

function toDto(c: {
  id: string;
  contenido: { id: string; titulo: string; imagenUrl: string | null; tipo: string; fuenteExterna: string; idExterno: string };
  usuarioOrigen: { id: string; nombre: string };
  usuarioDestino: { id: string; nombre: string };
  estado: string;
  fechaEnvio: Date;
}): ComparticionDto {
  return {
    id: c.id,
    contenido: c.contenido,
    usuarioOrigen: c.usuarioOrigen,
    usuarioDestino: c.usuarioDestino,
    estado: c.estado as ComparticionDto["estado"],
    fechaEnvio: c.fechaEnvio.toISOString(),
  };
}

export class CompartirContenidoUseCase {
  constructor(
    private readonly comparticionRepo: IComparticionRepository,
    private readonly contenidoRepo: IContenidoRepository,
    private readonly usuarioRepo: IUsuarioRepository
  ) {}

  async execute(
    usuarioOrigenId: string,
    contenidoId: string,
    usuarioDestinoId: string
  ): Promise<{ comparticion: ComparticionDto; status: 200 | 201 }> {
    if (!usuarioOrigenId) throw new UnauthorizedError("Usuario no autenticado");
    if (!contenidoId) throw new ValidationError("contenidoId es obligatorio");
    if (!usuarioDestinoId) throw new ValidationError("usuarioDestinoId es obligatorio");

    if (usuarioOrigenId === usuarioDestinoId) {
      throw new ValidationError("No puedes compartir contenido contigo mismo");
    }

    // validar existencia contenido y usuario destino
    const contenido = await this.contenidoRepo.findById(contenidoId);
    if (!contenido) throw new NotFoundError("Contenido no encontrado");

    const destino = await this.usuarioRepo.findById(usuarioDestinoId);
    if (!destino) throw new NotFoundError("Usuario destino no encontrado");

    // Si ya existe pendiente, reenvío: actualizar fecha_envio y devolver 200
    const pendiente = await this.comparticionRepo.findPendiente(
      usuarioOrigenId,
      usuarioDestinoId,
      contenidoId
    );
    if (pendiente) {
      const actualizado = await this.comparticionRepo.updateFechaEnvio(
        pendiente.id,
        new Date()
      );
      const conDetalles = await this.comparticionRepo.findByIdConDetalles(actualizado.id);
      if (!conDetalles) throw new NotFoundError("Compartición no encontrada");
      return { comparticion: toDto(conDetalles), status: 200 };
    }

    // Si anterior estaba rechazada o no existía, crear nueva (201)
    const nueva = await this.comparticionRepo.create({
      contenidoId,
      usuarioOrigenId,
      usuarioDestinoId,
    });
    const conDetalles = await this.comparticionRepo.findByIdConDetalles(nueva.id);
    if (!conDetalles) throw new NotFoundError("Compartición no encontrada");
    return { comparticion: toDto(conDetalles), status: 201 };
  }
}
