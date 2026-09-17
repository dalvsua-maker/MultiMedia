import { Lista, ListaConContenidos } from "@/domain/entities/Lista";
import {
  IListaRepository,
  CrearListaData,
} from "@/domain/repositories/IListaRepository";
import { prisma } from "@/infrastructure/database/prisma";

function toLista(raw: {
  id: string;
  usuarioId: string;
  nombre: string;
  descripcion: string | null;
  fechaCreacion: Date;
}): Lista {
  return new Lista({
    id: raw.id,
    usuarioId: raw.usuarioId,
    nombre: raw.nombre,
    descripcion: raw.descripcion,
    fechaCreacion: raw.fechaCreacion,
  });
}

export class PrismaListaRepository implements IListaRepository {
  async create(data: CrearListaData): Promise<Lista> {
    const created = await prisma.lista.create({
      data: {
        usuarioId: data.usuarioId,
        nombre: data.nombre,
        descripcion: data.descripcion ?? null,
      },
    });
    return toLista(created);
  }

  async findByUsuarioId(usuarioId: string): Promise<Lista[]> {
    const rows = await prisma.lista.findMany({
      where: { usuarioId },
      orderBy: { fechaCreacion: "desc" },
    });
    return rows.map(toLista);
  }

  async findById(id: string): Promise<Lista | null> {
    const found = await prisma.lista.findUnique({ where: { id } });
    return found ? toLista(found) : null;
  }

  async findByIdWithContenidos(id: string): Promise<ListaConContenidos | null> {
    const found = await prisma.lista.findUnique({
      where: { id },
      include: {
        contenidos: {
          include: { contenido: true },
          orderBy: { fechaAnadido: "desc" },
        },
      },
    });
    if (!found) return null;

    const contenidoIds = found.contenidos.map((lc) => lc.contenido.id);
    const estados = contenidoIds.length
      ? await prisma.usuarioContenido.findMany({
          where: { usuarioId: found.usuarioId, contenidoId: { in: contenidoIds } },
          select: { contenidoId: true, estado: true },
        })
      : [];
    const estadoMap = new Map(estados.map((e) => [e.contenidoId, e.estado]));

    return {
      id: found.id,
      usuarioId: found.usuarioId,
      nombre: found.nombre,
      descripcion: found.descripcion,
      fechaCreacion: found.fechaCreacion,
      contenidos: found.contenidos.map((lc) => ({
        id: lc.contenido.id,
        tipo: lc.contenido.tipo,
        titulo: lc.contenido.titulo,
        imagenUrl: lc.contenido.imagenUrl,
        fuenteExterna: lc.contenido.fuenteExterna,
        idExterno: lc.contenido.idExterno,
        fechaAnadido: lc.fechaAnadido,
        estado: (estadoMap.get(lc.contenido.id) as string | undefined) ?? null,
      })),
    };
  }

  async addContenido(listaId: string, contenidoId: string): Promise<void> {
    await prisma.listaContenido.create({
      data: { listaId, contenidoId },
    });
  }

  async removeContenido(listaId: string, contenidoId: string): Promise<void> {
    await prisma.listaContenido.delete({
      where: {
        listaId_contenidoId: { listaId, contenidoId },
      },
    });
  }

  async existsContenidoInLista(
    listaId: string,
    contenidoId: string
  ): Promise<boolean> {
    const existing = await prisma.listaContenido.findUnique({
      where: { listaId_contenidoId: { listaId, contenidoId } },
    });
    return !!existing;
  }

  async contenidoExists(contenidoId: string): Promise<boolean> {
    const found = await prisma.contenido.findUnique({
      where: { id: contenidoId },
    });
    return !!found;
  }
}
