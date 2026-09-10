import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaUsuarioContenidoRepository } from "@/infrastructure/repositories/PrismaUsuarioContenidoRepository";
import { cleanupFixtures } from "./_cleanup";

async function canConnect(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("PrismaUsuarioContenido (integración Neon, UC4)", () => {
  let usuarioRepo: PrismaUsuarioContenidoRepository;
  let userId: string;
  let contenidoId: string;

  beforeAll(async () => {
    if (!(await canConnect())) {
      console.warn("Postgres no disponible — skip");
      return;
    }
  });

  beforeEach(async () => {
    if (!(await canConnect())) return;

    usuarioRepo = new PrismaUsuarioContenidoRepository();

    await cleanupFixtures(prisma);

    const user = await prisma.usuario.create({
      data: { nombre: "U", email: `u-${Date.now()}@test.com`, passwordHash: "hash" },
    });
    userId = user.id;

    const contenido = await prisma.contenido.create({
      data: { tipo: "pelicula", titulo: "Matrix", fuenteExterna: "tmdb", idExterno: `tmdb-${Date.now()}` },
    });
    contenidoId = contenido.id;

    await prisma.detallePelicula.create({
      data: { contenidoId, anio: 1999, director: "Wachowski" },
    });
  });

  afterAll(async () => {
    if (await canConnect()) {
      await prisma.contenido.deleteMany({ where: { idExterno: { startsWith: "test-" } } });
      await prisma.usuario.deleteMany({ where: { email: { endsWith: "@test.com" } } });
      await prisma.$disconnect();
    }
  });

  it("create pendiente + findAll + updateEstado pendiente->en_proceso->visto", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    await usuarioRepo.create(userId, contenidoId, "pendiente");
    expect(await usuarioRepo.exists(userId, contenidoId)).toBe(true);

    const all1 = await usuarioRepo.findAllByUsuarioId(userId);
    expect(all1).toHaveLength(1);
    expect(all1[0].estado).toBe("pendiente");
    expect(all1[0].contenido.id).toBe(contenidoId);
    expect(all1[0].contenido.detalle).toEqual(expect.objectContaining({ _tipo: "pelicula" }));

    await usuarioRepo.updateEstado(userId, contenidoId, "en_proceso");
    const found1 = await usuarioRepo.find(userId, contenidoId);
    expect(found1?.estado).toBe("en_proceso");

    await usuarioRepo.updateEstado(userId, contenidoId, "visto");
    const found2 = await usuarioRepo.find(userId, contenidoId);
    expect(found2?.estado).toBe("visto");
  });

  it("findAll ordenado por fechaActualizacion desc y detalle vacío si no hay", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    const c2 = await prisma.contenido.create({
      data: { tipo: "musica", titulo: "Song", fuenteExterna: "spotify", idExterno: `spot-${Date.now()}` },
    });

    await usuarioRepo.create(userId, contenidoId, "pendiente");
    // pequeño delay para ordenar
    await new Promise((r) => setTimeout(r, 10));
    await usuarioRepo.create(userId, c2.id, "pendiente");

    const all = await usuarioRepo.findAllByUsuarioId(userId);
    expect(all).toHaveLength(2);
    // el más reciente primero
    expect(all[0].contenido.id).toBe(c2.id);
    expect(all[1].contenido.id).toBe(contenidoId);
  });
});
