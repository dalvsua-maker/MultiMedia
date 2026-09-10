import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaListaRepository } from "@/infrastructure/repositories/PrismaListaRepository";
import { cleanupFixtures } from "./_cleanup";

async function canConnect(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("PrismaListaRepository (integración Postgres)", () => {
  let repo: PrismaListaRepository;
  let userId: string;
  let contenidoId: string;

  beforeAll(async () => {
    if (!(await canConnect())) {
      console.warn("Postgres no disponible — tests de integración se omiten. Ejecuta: docker compose up -d && npx prisma migrate deploy");
      return;
    }
    // Aplica migración si no existe (fallback a db push en dev)
    // Nota: en CI `npx prisma migrate deploy` se encarga
  });

  beforeEach(async () => {
    if (!(await canConnect())) return;

    repo = new PrismaListaRepository();
    // Limpieza
    await cleanupFixtures(prisma);

    // Usuario fixture
    const user = await prisma.usuario.create({
      data: {
        nombre: "Test User",
        email: `test-${Date.now()}@example.com`,
        passwordHash: "hash",
      },
    });
    userId = user.id;

    // Contenido fixture
    const contenido = await prisma.contenido.create({
      data: {
        tipo: "pelicula",
        titulo: "Matrix",
        fuenteExterna: "tmdb",
        idExterno: `test-${Date.now()}`,
      },
    });
    contenidoId = contenido.id;
  });

  afterAll(async () => {
    if (await canConnect()) {
      await prisma.contenido.deleteMany({ where: { idExterno: { startsWith: "test-" } } });
      await prisma.usuario.deleteMany({ where: { email: { endsWith: "@test.com" } } });
      await prisma.usuario.deleteMany({ where: { email: { endsWith: "@example.com" } } });
      await prisma.$disconnect();
    }
  });

  it("create + findByUsuarioId + findByIdWithContenidos", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    const lista = await repo.create({
      usuarioId: userId,
      nombre: "Favoritas",
      descripcion: "Top",
    });
    expect(lista.id).toBeDefined();
    expect(lista.nombre).toBe("Favoritas");

    const listas = await repo.findByUsuarioId(userId);
    expect(listas).toHaveLength(1);

    const detalleVacio = await repo.findByIdWithContenidos(lista.id);
    expect(detalleVacio?.contenidos).toHaveLength(0);

    await repo.addContenido(lista.id, contenidoId);
    expect(await repo.existsContenidoInLista(lista.id, contenidoId)).toBe(true);

    const detalleCon = await repo.findByIdWithContenidos(lista.id);
    expect(detalleCon?.contenidos).toHaveLength(1);
    expect(detalleCon?.contenidos[0].id).toBe(contenidoId);

    await repo.removeContenido(lista.id, contenidoId);
    expect(await repo.existsContenidoInLista(lista.id, contenidoId)).toBe(false);
  });

  it("contenidoExists y existsContenidoInLista", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }
    expect(await repo.contenidoExists(contenidoId)).toBe(true);
    expect(await repo.contenidoExists("00000000-0000-0000-0000-000000000000")).toBe(false);
  });
});
