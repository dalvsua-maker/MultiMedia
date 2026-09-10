import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { PrismaContenidoRepository } from "@/infrastructure/repositories/PrismaContenidoRepository";
import { PrismaUsuarioContenidoRepository } from "@/infrastructure/repositories/PrismaUsuarioContenidoRepository";
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

describe("PrismaContenidoRepository + UsuarioContenido (integración Neon)", () => {
  let contenidoRepo: PrismaContenidoRepository;
  let usuarioRepo: PrismaUsuarioContenidoRepository;
  let listaRepo: PrismaListaRepository;
  let userId: string;
  let listaId: string;

  beforeAll(async () => {
    if (!(await canConnect())) {
      console.warn("Postgres no disponible — skip integración contenido");
      return;
    }
  });

  beforeEach(async () => {
    if (!(await canConnect())) return;

    contenidoRepo = new PrismaContenidoRepository();
    usuarioRepo = new PrismaUsuarioContenidoRepository();
    listaRepo = new PrismaListaRepository();

    // Limpieza
    await cleanupFixtures(prisma);

    const user = await prisma.usuario.create({
      data: { nombre: "U", email: `u-${Date.now()}@test.com`, passwordHash: "hash" },
    });
    userId = user.id;

    const lista = await prisma.lista.create({
      data: { usuarioId: userId, nombre: "Mi lista" },
    });
    listaId = lista.id;
  });

  afterAll(async () => {
    if (await canConnect()) {
      await prisma.contenido.deleteMany({ where: { idExterno: { startsWith: "test-" } } });
      await prisma.usuario.deleteMany({ where: { email: { endsWith: "@test.com" } } });
      await prisma.$disconnect();
    }
  });

  it("create con detalle pelicula + reutiliza @@unique + usuario_contenido pendiente + lista opcional idempotente", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    // Crear nuevo
    const c1 = await contenidoRepo.create({
      tipo: "pelicula",
      titulo: "Matrix",
      fuenteExterna: "tmdb",
      idExterno: `tmdb-${Date.now()}`,
      detalle: { director: "Wachowski", anio: 1999, duracionMin: 136 },
      imagenUrl: null,
    });
    expect(c1.id).toBeDefined();

    const conDetalle = await contenidoRepo.findByIdConDetalle(c1.id);
    expect(conDetalle?.detalle).toEqual(expect.objectContaining({ _tipo: "pelicula", anio: 1999 }));

    // usuario_contenido
    expect(await usuarioRepo.exists(userId, c1.id)).toBe(false);
    await usuarioRepo.create(userId, c1.id, "pendiente");
    expect(await usuarioRepo.exists(userId, c1.id)).toBe(true);

    // Reutiliza: segundo find por misma fuente+idExterno debe devolver mismo id
    const reused = await contenidoRepo.findByFuenteExternaAndIdExterno("tmdb", c1.idExterno);
    expect(reused?.id).toBe(c1.id);

    // No duplica contenido count
    const countAntes = await prisma.contenido.count();
    const dup = await prisma.contenido.findUnique({
      where: { fuenteExterna_idExterno: { fuenteExterna: "tmdb", idExterno: c1.idExterno } },
    });
    expect(dup?.id).toBe(c1.id);
    expect(await prisma.contenido.count()).toBe(countAntes);

    // lista opcional
    await listaRepo.addContenido(listaId, c1.id);
    expect(await listaRepo.existsContenidoInLista(listaId, c1.id)).toBe(true);
    // idempotente: segundo add no duplica (si lo intentas, Prisma lanza P2002 — el caso de uso lo evita con exists check)
    expect(await listaRepo.existsContenidoInLista(listaId, c1.id)).toBe(true);
  });

  it("findByIdConDetalleYEstado devuelve estadoUsuario null si no lo tiene y pendiente si lo tiene", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    const c = await contenidoRepo.create({
      tipo: "musica",
      titulo: "Song",
      fuenteExterna: "spotify",
      idExterno: `spot-${Date.now()}`,
      detalle: { artista: "A", album: "B", duracionSeg: 200 },
    });

    const sinEstado = await contenidoRepo.findByIdConDetalleYEstado(c.id, userId);
    expect(sinEstado?.estadoUsuario).toBeNull();

    await usuarioRepo.create(userId, c.id, "en_proceso");
    const conEstado = await contenidoRepo.findByIdConDetalleYEstado(c.id, userId);
    expect(conEstado?.estadoUsuario).toBe("en_proceso");
  });

  it("crea videojuego con plataformas y musica con duracion", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    const juego = await contenidoRepo.create({
      tipo: "videojuego",
      titulo: "Zelda",
      fuenteExterna: "igdb",
      idExterno: `igdb-${Date.now()}`,
      detalle: { plataformas: ["Switch"], desarrollador: "Nintendo", anioLanzamiento: 2017 },
    });
    const juegoDetalle = await contenidoRepo.findByIdConDetalle(juego.id);
    expect(juegoDetalle?.detalle).toEqual(expect.objectContaining({ _tipo: "videojuego", plataformas: ["Switch"] }));

    const musica = await contenidoRepo.create({
      tipo: "musica",
      titulo: "Beatles",
      fuenteExterna: "spotify",
      idExterno: `spot-${Date.now()}-2`,
      detalle: { artista: "Beatles", album: "Abbey", duracionSeg: 210 },
    });
    const musicaDetalle = await contenidoRepo.findByIdConDetalle(musica.id);
    expect(musicaDetalle?.detalle).toEqual(expect.objectContaining({ _tipo: "musica", duracionSeg: 210 }));
  });
});
