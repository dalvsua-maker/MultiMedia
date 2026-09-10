import { prisma } from "@/infrastructure/database/prisma";
import {
  Comparticion,
  EstadoComparticion,
} from "@/domain/entities/Comparticion";
import {
  IComparticionRepository,
  ComparticionConDetalles,
} from "@/domain/repositories/IComparticionRepository";

function toDomain(raw: {
  id: string;
  contenidoId: string;
  usuarioOrigenId: string;
  usuarioDestinoId: string;
  estado: string;
  fechaEnvio: Date;
}): Comparticion {
  return new Comparticion({
    id: raw.id,
    contenidoId: raw.contenidoId,
    usuarioOrigenId: raw.usuarioOrigenId,
    usuarioDestinoId: raw.usuarioDestinoId,
    estado: raw.estado as EstadoComparticion,
    fechaEnvio: raw.fechaEnvio,
  });
}

function toConDetalles(raw: {
  id: string;
  contenidoId: string;
  usuarioOrigenId: string;
  usuarioDestinoId: string;
  estado: string;
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
}): ComparticionConDetalles {
  return {
    id: raw.id,
    contenidoId: raw.contenidoId,
    usuarioOrigenId: raw.usuarioOrigenId,
    usuarioDestinoId: raw.usuarioDestinoId,
    estado: raw.estado as EstadoComparticion,
    fechaEnvio: raw.fechaEnvio,
    contenido: raw.contenido,
    usuarioOrigen: raw.usuarioOrigen,
    usuarioDestino: raw.usuarioDestino,
  };
}

const includeDetalles = {
  contenido: {
    select: {
      id: true,
      titulo: true,
      imagenUrl: true,
      tipo: true,
      fuenteExterna: true,
      idExterno: true,
    },
  },
  usuarioOrigen: { select: { id: true, nombre: true } },
  usuarioDestino: { select: { id: true, nombre: true } },
};

export class PrismaComparticionRepository implements IComparticionRepository {
  async create(data: {
    contenidoId: string;
    usuarioOrigenId: string;
    usuarioDestinoId: string;
  }): Promise<Comparticion> {
    const created = await prisma.comparticion.create({
      data: {
        contenidoId: data.contenidoId,
        usuarioOrigenId: data.usuarioOrigenId,
        usuarioDestinoId: data.usuarioDestinoId,
        estado: "pendiente",
      },
    });
    return toDomain(created);
  }

  async findPendiente(
    usuarioOrigenId: string,
    usuarioDestinoId: string,
    contenidoId: string
  ): Promise<Comparticion | null> {
    const found = await prisma.comparticion.findFirst({
      where: {
        usuarioOrigenId,
        usuarioDestinoId,
        contenidoId,
        estado: "pendiente",
      },
      orderBy: { fechaEnvio: "desc" },
    });
    return found ? toDomain(found) : null;
  }

  async findById(id: string): Promise<Comparticion | null> {
    const found = await prisma.comparticion.findUnique({ where: { id } });
    return found ? toDomain(found) : null;
  }

  async findByIdConDetalles(id: string): Promise<ComparticionConDetalles | null> {
    const found = await prisma.comparticion.findUnique({
      where: { id },
      include: includeDetalles,
    });
    return found ? toConDetalles(found as never) : null;
  }

  async findByUsuario(
    usuarioId: string
  ): Promise<{ enviadas: ComparticionConDetalles[]; recibidas: ComparticionConDetalles[] }> {
    const [enviadas, recibidas] = await Promise.all([
      prisma.comparticion.findMany({
        where: { usuarioOrigenId: usuarioId },
        include: includeDetalles,
        orderBy: { fechaEnvio: "desc" },
      }),
      prisma.comparticion.findMany({
        where: { usuarioDestinoId: usuarioId },
        include: includeDetalles,
        orderBy: { fechaEnvio: "desc" },
      }),
    ]);
    return {
      enviadas: enviadas.map((r) => toConDetalles(r as never)),
      recibidas: recibidas.map((r) => toConDetalles(r as never)),
    };
  }

  async updateFechaEnvio(id: string, fechaEnvio: Date): Promise<Comparticion> {
    const updated = await prisma.comparticion.update({
      where: { id },
      data: { fechaEnvio },
    });
    return toDomain(updated);
  }

  async updateEstado(id: string, estado: EstadoComparticion): Promise<Comparticion> {
    const updated = await prisma.comparticion.update({
      where: { id },
      data: { estado },
    });
    return toDomain(updated);
  }
}
