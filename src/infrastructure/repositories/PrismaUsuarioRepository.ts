import { Usuario } from "@/domain/entities/Usuario";
import { IUsuarioRepository } from "@/domain/repositories/IUsuarioRepository";
import { prisma } from "@/infrastructure/database/prisma";

function toDomain(raw: {
  id: string;
  nombre: string;
  email: string;
  passwordHash: string;
  fechaRegistro: Date;
}): Usuario {
  return new Usuario({
    id: raw.id,
    nombre: raw.nombre,
    email: raw.email,
    passwordHash: raw.passwordHash,
    fechaRegistro: raw.fechaRegistro,
  });
}

export class PrismaUsuarioRepository implements IUsuarioRepository {
  async findByEmail(email: string): Promise<Usuario | null> {
    const found = await prisma.usuario.findUnique({ where: { email } });
    return found ? toDomain(found) : null;
  }

  async findById(id: string): Promise<Usuario | null> {
    const found = await prisma.usuario.findUnique({ where: { id } });
    return found ? toDomain(found) : null;
  }

  async create(data: {
    nombre: string;
    email: string;
    passwordHash: string;
  }): Promise<Usuario> {
    const created = await prisma.usuario.create({
      data: {
        nombre: data.nombre,
        email: data.email,
        passwordHash: data.passwordHash,
      },
    });
    return toDomain(created);
  }

  async buscarPorNombre(
    q: string,
    excluidoId: string,
    limite = 10
  ): Promise<{ id: string; nombre: string }[]> {
    const rows = await prisma.usuario.findMany({
      where: {
        nombre: { contains: q, mode: "insensitive" },
        NOT: { id: excluidoId },
      },
      select: { id: true, nombre: true },
      take: limite,
      orderBy: { nombre: "asc" },
    });
    return rows;
  }
}
