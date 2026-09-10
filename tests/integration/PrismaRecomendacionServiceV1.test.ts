import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { RecomendacionServiceV1 } from "@/infrastructure/services/RecomendacionServiceV1";
import { cleanupFixtures } from "./_cleanup";

async function canConnect(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("RecomendacionServiceV1 (integración Neon, UC6)", () => {
  let service: RecomendacionServiceV1;
  let userA: string;
  let userB: string;
  let userC: string; // sin historial
  let peli1: string;
  let peli2: string;
  let serie1: string;
  let musica1: string;

  beforeAll(async () => {
    if (!(await canConnect())) {
      console.warn("Postgres no disponible — skip UC6 integración");
      return;
    }
  });

  beforeEach(async () => {
    if (!(await canConnect())) return;

    service = new RecomendacionServiceV1();

    await cleanupFixtures(prisma);

    const ts = Date.now();
    const a = await prisma.usuario.create({ data: { nombre: "A", email: `a-${ts}@test.com`, passwordHash: "hash" } });
    const b = await prisma.usuario.create({ data: { nombre: "B", email: `b-${ts}@test.com`, passwordHash: "hash" } });
    const c = await prisma.usuario.create({ data: { nombre: "C", email: `c-${ts}@test.com`, passwordHash: "hash" } });
    userA = a.id;
    userB = b.id;
    userC = c.id;

    // Contenidos
    const cPeli1 = await prisma.contenido.create({ data: { tipo: "pelicula", titulo: "Peli1", fuenteExterna: "tmdb", idExterno: `tmdb-${ts}-1` } });
    const cPeli2 = await prisma.contenido.create({ data: { tipo: "pelicula", titulo: "Peli2", fuenteExterna: "tmdb", idExterno: `tmdb-${ts}-2` } });
    const cSerie1 = await prisma.contenido.create({ data: { tipo: "serie", titulo: "Serie1", fuenteExterna: "tmdb", idExterno: `tmdb-${ts}-3` } });
    const cMusica1 = await prisma.contenido.create({ data: { tipo: "musica", titulo: "Musica1", fuenteExterna: "spotify", idExterno: `spot-${ts}-1` } });
    peli1 = cPeli1.id;
    peli2 = cPeli2.id;
    serie1 = cSerie1.id;
    musica1 = cMusica1.id;

    // Popularidad: Peli1 es la más popular (3 usuarios la tienen), Peli2 1, Serie1 1, Musica1 1
    // UserA: afinidad pelicula (2 peliculas, 1 serie) → top pelicula
    await prisma.usuarioContenido.createMany({
      data: [
        { usuarioId: userA, contenidoId: peli1, estado: "visto" },
        { usuarioId: userA, contenidoId: peli2, estado: "pendiente" },
        { usuarioId: userA, contenidoId: serie1, estado: "en_proceso" },
        // B también tiene peli1 y musica1
        { usuarioId: userB, contenidoId: peli1, estado: "visto" },
        { usuarioId: userB, contenidoId: musica1, estado: "pendiente" },
        // C (usuario nuevo) no tiene nada — para fallback test crearemos otro usuario sin filas
      ],
    });
    // Añadir un tercer usuario que también tiene peli1 para hacerla más popular
    const d = await prisma.usuario.create({ data: { nombre: "D", email: `d-${ts}@test.com`, passwordHash: "hash" } });
    await prisma.usuarioContenido.create({ data: { usuarioId: d.id, contenidoId: peli1, estado: "visto" } });

    // Crear contenidos extra populares de tipo pelicula que A no tiene, para que puedan ser recomendados
    const extraPeli = await prisma.contenido.create({ data: { tipo: "pelicula", titulo: "PeliExtra", fuenteExterna: "tmdb", idExterno: `tmdb-${ts}-extra` } });
    await prisma.usuarioContenido.createMany({
      data: [
        { usuarioId: userB, contenidoId: extraPeli.id, estado: "visto" },
        { usuarioId: d.id, contenidoId: extraPeli.id, estado: "visto" },
      ],
    });
  });

  afterAll(async () => {
    if (await canConnect()) {
      await prisma.$executeRaw`
        DELETE FROM contenidos
        WHERE id_externo ~ '^(tmdb|spot|igdb)-[0-9]{10,}'
           OR id_externo LIKE 'test-%'
           OR id_externo LIKE 'tmdb-c1-%'
           OR id_externo LIKE 'tmdb-c2-%'
           OR id_externo LIKE 'tmdb-emp%'
           OR id_externo LIKE 'sp-det-%'
           OR id_externo LIKE 'igdb-det-%'
      `;
      await prisma.usuario.deleteMany({ where: { email: { endsWith: "@test.com" } } });
      await prisma.$disconnect();
    }
  });

  it("recomienda por afinidad pelicula y excluye lo ya poseído en cualquier estado", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    const recs = await service.recomendar(userA);
    // A ya tiene peli1,peli2,serie1 — ninguno de esos debe aparecer
    expect(recs.find((c) => c.id === peli1)).toBeUndefined();
    expect(recs.find((c) => c.id === peli2)).toBeUndefined();
    expect(recs.find((c) => c.id === serie1)).toBeUndefined();
    // Debe recomendar PeliExtra (popular pelicula que A no tiene)
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((c) => c.tipo === "pelicula")).toBe(true);
    expect(recs.length).toBeLessThanOrEqual(10);
  });

  it("exclusión estricta: no recomienda contenido en pendiente/en_proceso/visto del usuario", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    // A tiene peli1 en visto, peli2 en pendiente, serie1 en en_proceso — ninguno debe aparecer
    const recs = await service.recomendar(userA);
    const ids = new Set(recs.map((c) => c.id));
    expect(ids.has(peli1)).toBe(false);
    expect(ids.has(peli2)).toBe(false);
    expect(ids.has(serie1)).toBe(false);
  });

  it("fallback usuario nuevo (sin historial) devuelve populares globales sin filtrar por tipo", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    const recs = await service.recomendar(userC);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(10);
    // No debe estar vacío aunque no tenga afinidad
    // Y ninguno de los que ya tiene (0) debe excluir nada, así que puede ser pelicula o musica
  });

  it("desempate afinidad determinista ASC (no RANDOM)", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    // Crear usuario con empate 1 pelicula, 1 serie
    const ts = Date.now();
    const u = await prisma.usuario.create({ data: { nombre: "Empate", email: `emp-${ts}@test.com`, passwordHash: "hash" } });
    // Necesita contenidos adicionales para empate
    const peliEmpate = await prisma.contenido.create({ data: { tipo: "pelicula", titulo: "PeliEmp", fuenteExterna: "tmdb", idExterno: `tmdb-emp-${ts}` } });
    const serieEmpate = await prisma.contenido.create({ data: { tipo: "serie", titulo: "SerieEmp", fuenteExterna: "tmdb", idExterno: `tmdb-emp2-${ts}` } });
    await prisma.usuarioContenido.createMany({
      data: [
        { usuarioId: u.id, contenidoId: peliEmpate.id, estado: "visto" },
        { usuarioId: u.id, contenidoId: serieEmpate.id, estado: "visto" },
      ],
    });

    const recs1 = await service.recomendar(u.id);
    const recs2 = await service.recomendar(u.id);
    // Determinista: dos llamadas mismo resultado orden
    expect(recs1.map((c) => c.id)).toEqual(recs2.map((c) => c.id));
    // Top tipo debe ser pelicula (ASC desempata) ya que "pelicula" < "serie"
    if (recs1.length > 0) {
      expect(recs1.every((c) => c.tipo === "pelicula")).toBe(true);
    }
  });

  it("límite 10", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    const recs = await service.recomendar(userA);
    expect(recs.length).toBeLessThanOrEqual(10);
  });

  it("fallback C1: BD con poca actividad, completo del top-tipo aunque no sea popular", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    // Empezamos desde un universo mínimo: 1 usuario, 1 contenido poseído,
    // 1 contenido no poseído del MISMO tipo que la afinidad. La afinidad del
    // usuario es pelicula (porque solo tiene peliculas en su historial).
    // El único candidato "popular pelicula" es el que ya tiene → paso A devuelve [].
    // Paso B (populares globales) tampoco encuentra nada porque todo lo popular
    // está en el tipo que no nos sirve. Entonces debe activarse el paso C1:
    // recomendar el reciente pelicula no poseído.
    const ts = Date.now();
    const u = await prisma.usuario.create({
      data: { nombre: "U-C1", email: `uc1-${ts}@test.com`, passwordHash: "hash" },
    });
    const peliPoseida = await prisma.contenido.create({
      data: { tipo: "pelicula", titulo: "PeliPoseida", fuenteExterna: "tmdb", idExterno: `tmdb-c1-${ts}-1` },
    });
    const peliReciente = await prisma.contenido.create({
      data: { tipo: "pelicula", titulo: "PeliReciente", fuenteExterna: "tmdb", idExterno: `tmdb-c1-${ts}-2` },
    });
    // Crear un popular de tipo diferente para confirmar que paso B no nos lo
    // devuelve (filtro del top-tipo no aplica en B, pero C1 debe respetarlo:
    // una serie no debería entrar cuando la afinidad es pelicula).
    const seriePopular = await prisma.contenido.create({
      data: { tipo: "serie", titulo: "SeriePopular", fuenteExterna: "tmdb", idExterno: `tmdb-c1-${ts}-3` },
    });
    await prisma.usuarioContenido.createMany({
      data: [
        // Afinidad del usuario: pelicula (1 fila)
        { usuarioId: u.id, contenidoId: peliPoseida.id, estado: "visto" },
        // PeliPoseida tiene pop=1 (afinidad del propio usuario) — paso A lo excluye
        // SeriePopular tiene pop=0 → paso A y B no la devuelven. Tampoco debe salir en C1 porque el top-tipo es pelicula.
      ],
    });

    const recs = await service.recomendar(u.id);
    expect(recs.length).toBeGreaterThan(0);
    // Paso C1 trajo PeliReciente (es del top-tipo y no poseído)
    expect(recs.find((c) => c.id === peliReciente.id)).toBeDefined();
    // La poseída nunca aparece
    expect(recs.find((c) => c.id === peliPoseida.id)).toBeUndefined();
    // C1 filtra por top-tipo → no debe traer la serie
    expect(recs.find((c) => c.id === seriePopular.id)).toBeUndefined();
    expect(recs.every((c) => c.tipo === "pelicula")).toBe(true);
  });

  it("fallback C2: si no hay recientes del top-tipo, completa con cualquier tipo no poseído", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    // Universo: usuario con afinidad pelicula, no tiene nada más.
    // El ÚNICO contenido no poseído es una serie sin popularidad.
    // → paso A (populares pelicula) vacío
    // → paso B (populares globales) vacío
    // → paso C1 (recientes pelicula) vacío (no hay series)
    // → paso C2 (recientes globales) debe traer la serie
    const ts = Date.now();
    const u = await prisma.usuario.create({
      data: { nombre: "U-C2", email: `uc2-${ts}@test.com`, passwordHash: "hash" },
    });
    const peliPoseida = await prisma.contenido.create({
      data: { tipo: "pelicula", titulo: "PeliPoseida2", fuenteExterna: "tmdb", idExterno: `tmdb-c2-${ts}-1` },
    });
    const serieReciente = await prisma.contenido.create({
      data: { tipo: "serie", titulo: "SerieReciente", fuenteExterna: "tmdb", idExterno: `tmdb-c2-${ts}-2` },
    });
    await prisma.usuarioContenido.create({
      data: { usuarioId: u.id, contenidoId: peliPoseida.id, estado: "visto" },
    });

    const recs = await service.recomendar(u.id);
    expect(recs.length).toBe(1);
    expect(recs[0].id).toBe(serieReciente.id);
    expect(recs[0].tipo).toBe("serie");
  });

  it("determinismo del fallback: dos llamadas devuelven mismo orden", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }

    // Crear 3 contenidos recientes no poseídos, sin filas en usuario_contenido.
    // Con afinidad que no matchee con ninguno de sus tipos, los pasos A/B no
    // traerán nada y C1 tampoco; C2 los devolverá por fecha_anadido DESC.
    const ts = Date.now();
    const u = await prisma.usuario.create({
      data: { nombre: "U-Det", email: `udet-${ts}@test.com`, passwordHash: "hash" },
    });
    const juegoPoseido = await prisma.contenido.create({
      data: { tipo: "videojuego", titulo: "JuegoPoseido", fuenteExterna: "igdb", idExterno: `igdb-det-${ts}-1` },
    });
    // Crear contenidos en orden cronológico explícito
    const c1 = await prisma.contenido.create({
      data: { tipo: "musica", titulo: "C1", fuenteExterna: "spotify", idExterno: `sp-det-${ts}-1` },
    });
    await new Promise((r) => setTimeout(r, 10));
    const c2 = await prisma.contenido.create({
      data: { tipo: "musica", titulo: "C2", fuenteExterna: "spotify", idExterno: `sp-det-${ts}-2` },
    });
    await new Promise((r) => setTimeout(r, 10));
    const c3 = await prisma.contenido.create({
      data: { tipo: "musica", titulo: "C3", fuenteExterna: "spotify", idExterno: `sp-det-${ts}-3` },
    });
    await prisma.usuarioContenido.create({
      data: { usuarioId: u.id, contenidoId: juegoPoseido.id, estado: "visto" },
    });

    const recs1 = await service.recomendar(u.id);
    const recs2 = await service.recomendar(u.id);
    // Determinismo: dos llamadas idénticas
    expect(recs1.map((c) => c.id)).toEqual(recs2.map((c) => c.id));
    // Sin popularidad en ninguno, el orden es fecha_anadido DESC
    expect(recs1.map((c) => c.id)).toEqual([c3.id, c2.id, c1.id]);
  });
});
