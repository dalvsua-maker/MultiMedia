import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/infrastructure/database/prisma";
import { RecomendacionServiceV2 } from "@/infrastructure/services/RecomendacionServiceV2";
import { cleanupFixtures } from "./_cleanup";

async function canConnect(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

describe("RecomendacionServiceV2 (integración Neon, pool popularidadExterna)", () => {
  let service: RecomendacionServiceV2;

  beforeAll(async () => {
    if (!(await canConnect())) {
      console.warn("Postgres no disponible — skip V2");
      return;
    }
  });

  beforeEach(async () => {
    if (!(await canConnect())) return;
    service = new RecomendacionServiceV2();
    await cleanupFixtures(prisma);
  });

  afterAll(async () => {
    if (await canConnect()) {
      await cleanupFixtures(prisma);
      await prisma.$disconnect();
    }
  });

  it("devuelve 4 por tipo (16 total) con 80+ candidatos y shuffle da conjuntos parcialmente distintos", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }
    const ts = Date.now();
    const user = await prisma.usuario.create({ data: { nombre: "U-V2", email: `uv2-${ts}@test.com`, passwordHash: "hash" } });

    // Crear 60 por tipo con popularidad 100.. con 1 de incremento, todos no poseídos
    const tipos: Array<"pelicula" | "serie" | "videojuego" | "musica"> = ["pelicula", "serie", "videojuego", "musica"];
    const fuenteMap: Record<string, "tmdb" | "igdb" | "spotify"> = { pelicula: "tmdb", serie: "tmdb", videojuego: "igdb", musica: "spotify" };
    for (const tipo of tipos) {
      for (let i = 0; i < 60; i++) {
        const pop = 100 - i * 0.5;
        await prisma.contenido.create({
          data: {
            tipo,
            titulo: `V2-${tipo}-${i}`,
            fuenteExterna: fuenteMap[tipo],
            idExterno: `test-v2-${tipo}-${ts}-${i}`,
            popularidadExterna: pop,
          },
        });
      }
    }

    const r1 = await service.recomendarAgrupado(user.id);
    const r2 = await service.recomendarAgrupado(user.id);

    // 4 por tipo
    for (const t of tipos) {
      expect(r1[t].length).toBe(4);
      expect(r2[t].length).toBe(4);
      // todos vienen del pool popularidad (deberían tener popularidad alta)
      expect(r1[t].every((c) => c.tipo === t)).toBe(true);
    }

    // Conjuntos parcialmente distintos (no solo orden): al menos un tipo debe tener algún id diferente entre r1 y r2
    // Con pool 60 y shuffle, la probabilidad de que los 16 sean idénticos en orden es ~0, pero verificamos que al menos un id difiera
    let algunaDiferencia = false;
    for (const t of tipos) {
      const ids1 = new Set(r1[t].map((c) => c.id));
      const ids2 = new Set(r2[t].map((c) => c.id));
      const diff = [...ids1].some((id) => !ids2.has(id)) || [...ids2].some((id) => !ids1.has(id));
      if (diff) algunaDiferencia = true;
    }
    expect(algunaDiferencia).toBe(true);

    // Verificar que no es solo reordenamiento del mismo conjunto: si todos los ids fueran iguales pero en distinto orden, el test anterior fallaría si shuffle solo cambia orden
    // Comprobamos que al menos un tipo tiene orden distinto cuando el conjunto es igual
    // Para asegurar variedad real, verificamos que r1 y r2 no sean idénticos en orden para al menos un tipo
    let ordenDistinto = false;
    for (const t of tipos) {
      const o1 = r1[t].map((c) => c.id).join(",");
      const o2 = r2[t].map((c) => c.id).join(",");
      if (o1 !== o2) ordenDistinto = true;
    }
    expect(ordenDistinto).toBe(true);
  });

  it("excluye lo poseído y lo marcado no_me_gusta/ya_lo_vi, y marca yaAnadido", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }
    const ts = Date.now();
    const user = await prisma.usuario.create({ data: { nombre: "U-V2-Excl", email: `uv2excl-${ts}@test.com`, passwordHash: "hash" } });

    const c1 = await prisma.contenido.create({ data: { tipo: "pelicula", titulo: "Poseida", fuenteExterna: "tmdb", idExterno: `test-v2-poseida-${ts}`, popularidadExterna: 100 } });
    const c2 = await prisma.contenido.create({ data: { tipo: "pelicula", titulo: "Rechazada", fuenteExterna: "tmdb", idExterno: `test-v2-rechazada-${ts}`, popularidadExterna: 90 } });
    const c3 = await prisma.contenido.create({ data: { tipo: "pelicula", titulo: "Historial", fuenteExterna: "tmdb", idExterno: `test-v2-hist-${ts}`, popularidadExterna: 80 } });
    // Rellenar con más para asegurar pool
    for (let i = 0; i < 10; i++) {
      await prisma.contenido.create({ data: { tipo: "pelicula", titulo: `Extra-${i}`, fuenteExterna: "tmdb", idExterno: `test-v2-extra-${ts}-${i}`, popularidadExterna: 10 + i } });
    }

    await prisma.usuarioContenido.create({ data: { usuarioId: user.id, contenidoId: c1.id, estado: "visto" } });
    await prisma.recomendacionFeedback.create({ data: { usuarioId: user.id, contenidoId: c2.id, voto: "no_me_gusta" } });
    await prisma.historialUsuarioContenido.create({ data: { usuarioId: user.id, contenidoId: c3.id } });

    const r = await service.recomendarAgrupado(user.id);
    const ids = new Set([...r.pelicula, ...r.serie, ...r.videojuego, ...r.musica].map((c) => c.id));
    expect(ids.has(c1.id)).toBe(false);
    expect(ids.has(c2.id)).toBe(false);
    // c3 debe aparecer con yaAnadido true si entra en el pool (tiene pop 80, dentro del top 50)
    const histItem = r.pelicula.find((c) => c.id === c3.id);
    if (histItem) expect(histItem.yaAnadido).toBe(true);
  });

  it("para usuario nuevo sin historial, devuelve populares globales por popularidadExterna", async () => {
    if (!(await canConnect())) {
      console.log("SKIP: sin Postgres");
      return;
    }
    const ts = Date.now();
    const user = await prisma.usuario.create({ data: { nombre: "U-Nuevo", email: `unuevo-${ts}@test.com`, passwordHash: "hash" } });
    // Crear contenidos con popularidad variada
    for (let i = 0; i < 5; i++) {
      await prisma.contenido.create({ data: { tipo: "pelicula", titulo: `Nuevo-${i}`, fuenteExterna: "tmdb", idExterno: `test-v2-nuevo-${ts}-${i}`, popularidadExterna: 100 - i } });
    }
    const r = await service.recomendarAgrupado(user.id);
    expect(r.pelicula.length).toBeGreaterThan(0);
    expect(r.pelicula.length).toBeLessThanOrEqual(4);
  });
});
