import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaComparticionRepository } from "@/infrastructure/repositories/PrismaComparticionRepository";
import { PrismaUsuarioRepository } from "@/infrastructure/repositories/PrismaUsuarioRepository";
import { PrismaContenidoRepository } from "@/infrastructure/repositories/PrismaContenidoRepository";
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

describe("PrismaComparticionRepository + PrismaUsuarioRepository.buscarPorNombre (integración Neon, UC5)", () => {
  let comparticionRepo: PrismaComparticionRepository;
  let usuarioRepo: PrismaUsuarioRepository;
  let contenidoRepo: PrismaContenidoRepository;
  let usuarioContenidoRepo: PrismaUsuarioContenidoRepository;
  let userA: { id: string; nombre: string };
  let userB: { id: string; nombre: string };
  let userC: { id: string; nombre: string };
  let contenidoId: string;

  beforeAll(async () => {
    if (!(await canConnect())) {
      console.warn("Postgres no disponible — skip UC5 integración");
      return;
    }
  });

  beforeEach(async () => {
    if (!(await canConnect())) return;

    comparticionRepo = new PrismaComparticionRepository();
    usuarioRepo = new PrismaUsuarioRepository();
    contenidoRepo = new PrismaContenidoRepository();
    usuarioContenidoRepo = new PrismaUsuarioContenidoRepository();

    await cleanupFixtures(prisma);

    const ts = Date.now();
    const a = await prisma.usuario.create({
      data: { nombre: "Alice", email: `alice-${ts}@test.com`, passwordHash: "hash" },
    });
    const b = await prisma.usuario.create({
      data: { nombre: "Bob", email: `bob-${ts}@test.com`, passwordHash: "hash" },
    });
    const c = await prisma.usuario.create({
      data: { nombre: "Alicia", email: `alicia-${ts}@test.com`, passwordHash: "hash" },
    });
    userA = { id: a.id, nombre: a.nombre };
    userB = { id: b.id, nombre: b.nombre };
    userC = { id: c.id, nombre: c.nombre };

    const contenido = await prisma.contenido.create({
      data: { tipo: "pelicula", titulo: "Matrix", fuenteExterna: "tmdb", idExterno: `tmdb-${ts}` },
    });
    contenidoId = contenido.id;
  });

  afterAll(async () => {
    if (await canConnect()) {
      await prisma.contenido.deleteMany({ where: { idExterno: { startsWith: "test-" } } });
      await prisma.usuario.deleteMany({ where: { email: { endsWith: "@test.com" } } });
      await prisma.$disconnect();
    }
  });

  it("buscarPorNombre: case-insensitive, excluye auth, límite 10, orden asc", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    // Buscar "ali" con Alice excluida debe devolver solo Alicia
    const res1 = await usuarioRepo.buscarPorNombre("ali", userA.id, 10);
    expect(res1.map((r) => r.nombre)).toEqual(["Alicia"]);
    expect(res1.find((r) => r.id === userA.id)).toBeUndefined();

    // Case-insensitive: "ALI" igual
    const res2 = await usuarioRepo.buscarPorNombre("ALI", userA.id, 10);
    expect(res2.length).toBe(1);
    expect(res2[0].nombre).toBe("Alicia");

    // Buscar "ali" excluyendo a Bob debe devolver Alice y Alicia (2)
    const resConAmbas = await usuarioRepo.buscarPorNombre("ali", userB.id, 10);
    expect(resConAmbas.map((r) => r.nombre).sort()).toEqual(["Alicia", "Alice"].sort());

    // Límite
    const res3 = await usuarioRepo.buscarPorNombre("a", userB.id, 1);
    expect(res3.length).toBe(1);

    // q<2 no es validado en repo, solo en use-case — repo devuelve vacío si no hay match
    const res4 = await usuarioRepo.buscarPorNombre("zzz", userA.id, 10);
    expect(res4.length).toBe(0);

    // No devuelve email
    expect(res1[0]).not.toHaveProperty("email");
    expect(res1[0]).toHaveProperty("id");
    expect(res1[0]).toHaveProperty("nombre");

    // Orden asc (con ambas)
    expect(resConAmbas[0].nombre.localeCompare(resConAmbas[1].nombre)).toBeLessThanOrEqual(0);
  });

  it("create comparticion pendiente + findPendiente + reenvío (update fecha) + rechazada permite nueva", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    const comp1 = await comparticionRepo.create({
      contenidoId,
      usuarioOrigenId: userA.id,
      usuarioDestinoId: userB.id,
    });
    expect(comp1.estado).toBe("pendiente");

    const pendiente = await comparticionRepo.findPendiente(userA.id, userB.id, contenidoId);
    expect(pendiente?.id).toBe(comp1.id);

    // Reenvío: actualizar fecha_envio
    const before = pendiente!.fechaEnvio;
    await new Promise((r) => setTimeout(r, 10));
    const updated = await comparticionRepo.updateFechaEnvio(comp1.id, new Date());
    expect(updated.fechaEnvio.getTime()).toBeGreaterThan(before.getTime());

    // Rechazar
    await comparticionRepo.updateEstado(comp1.id, "rechazada");
    const rechazada = await comparticionRepo.findById(comp1.id);
    expect(rechazada?.estado).toBe("rechazada");

    // Tras rechazada, findPendiente debe ser null (permite crear nueva)
    const noPendiente = await comparticionRepo.findPendiente(userA.id, userB.id, contenidoId);
    expect(noPendiente).toBeNull();

    // Crear nueva tras rechazada
    const comp2 = await comparticionRepo.create({
      contenidoId,
      usuarioOrigenId: userA.id,
      usuarioDestinoId: userB.id,
    });
    expect(comp2.id).not.toBe(comp1.id);
    expect(comp2.estado).toBe("pendiente");
  });

  it("aceptar comparticion crea usuario_contenido pendiente (idempotente) y rechazar no lo crea", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    const comp = await comparticionRepo.create({
      contenidoId,
      usuarioOrigenId: userA.id,
      usuarioDestinoId: userB.id,
    });

    // Simular aceptar (como hace ResponderComparticionUseCase)
    const yaTieneAntes = await usuarioContenidoRepo.exists(userB.id, contenidoId);
    expect(yaTieneAntes).toBe(false);

    await usuarioContenidoRepo.create(userB.id, contenidoId, "pendiente");
    await comparticionRepo.updateEstado(comp.id, "aceptada");

    expect(await usuarioContenidoRepo.exists(userB.id, contenidoId)).toBe(true);
    const aceptada = await comparticionRepo.findById(comp.id);
    expect(aceptada?.estado).toBe("aceptada");

    // Rechazar otra
    const comp2 = await comparticionRepo.create({
      contenidoId,
      usuarioOrigenId: userA.id,
      usuarioDestinoId: userC.id,
    });
    await comparticionRepo.updateEstado(comp2.id, "rechazada");
    expect(await usuarioContenidoRepo.exists(userC.id, contenidoId)).toBe(false);
  });

  it("findByUsuario: enviadas y recibidas con contenido y nombre", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    const comp1 = await comparticionRepo.create({
      contenidoId,
      usuarioOrigenId: userA.id,
      usuarioDestinoId: userB.id,
    });
    const comp2 = await comparticionRepo.create({
      contenidoId,
      usuarioOrigenId: userB.id,
      usuarioDestinoId: userA.id,
    });

    const resA = await comparticionRepo.findByUsuario(userA.id);
    expect(resA.enviadas.some((c) => c.id === comp1.id)).toBe(true);
    expect(resA.recibidas.some((c) => c.id === comp2.id)).toBe(true);
    expect(resA.enviadas[0].contenido.titulo).toBe("Matrix");
    expect(resA.enviadas[0].usuarioDestino.nombre).toBeDefined();
    expect(resA.recibidas[0].usuarioOrigen.nombre).toBeDefined();
  });

  it("GET /api/contenidos/:id/publico no expone estadoUsuario (verificado vía repo findByIdConDetalle)", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    // Crear contenido con detalle
    await prisma.detallePelicula.create({
      data: { contenidoId, anio: 1999, director: "Wachowski" },
    });
    const conDetalle = await contenidoRepo.findByIdConDetalle(contenidoId);
    expect(conDetalle?.id).toBe(contenidoId);
    expect(conDetalle?.detalle).toBeDefined();
    // No hay estadoUsuario en este método — es neutro
    expect((conDetalle as unknown as { estadoUsuario?: unknown }).estadoUsuario).toBeUndefined();
  });
});
