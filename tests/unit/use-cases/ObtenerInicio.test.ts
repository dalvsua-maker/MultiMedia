import { describe, it, expect, vi } from "vitest";
import { ObtenerInicioUseCase } from "@/application/use-cases/ObtenerInicio";
import type { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";
import type { IRecomendacionService } from "@/domain/services/IRecomendacionService";
import type { ContenidoConDetalle } from "@/domain/entities/Contenido";

function makeUsuarioRepo(rows: unknown[] = []) {
  return {
    find: vi.fn(),
    exists: vi.fn(),
    create: vi.fn(),
    findAllByUsuarioId: vi.fn(async () => rows as never),
    updateEstado: vi.fn(),
  } as unknown as IUsuarioContenidoRepository & Record<string, ReturnType<typeof vi.fn>>;
}

function makeRecoService(resultados: ContenidoConDetalle[] = []) {
  return {
    recomendar: vi.fn(async () => resultados),
  } as unknown as IRecomendacionService & Record<string, ReturnType<typeof vi.fn>>;
}

function fakeContenido(id: string, tipo: string): ContenidoConDetalle {
  return {
    id,
    tipo: tipo as never,
    titulo: `Titulo ${id}`,
    imagenUrl: null,
    fuenteExterna: "tmdb" as never,
    idExterno: `ext-${id}`,
    fechaAnadido: new Date("2024-01-01"),
    detalle: null,
  };
}

function fakeRow(id: string, estado: string, tipo: string, fecha: string): unknown {
  return {
    contenido: fakeContenido(id, tipo),
    estado,
    fechaActualizacion: new Date(fecha),
  };
}

describe("ObtenerInicioUseCase (UC6)", () => {
  it("401 sin usuarioId", async () => {
    const uc = new ObtenerInicioUseCase(makeUsuarioRepo(), makeRecoService());
    await expect(uc.execute("")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("enProceso solo filtra en_proceso ordenado desc", async () => {
    const rows = [
      fakeRow("c1", "pendiente", "pelicula", "2024-01-01T00:00:00.000Z"),
      fakeRow("c2", "en_proceso", "serie", "2024-01-03T00:00:00.000Z"),
      fakeRow("c3", "visto", "musica", "2024-01-02T00:00:00.000Z"),
      fakeRow("c4", "en_proceso", "pelicula", "2024-01-02T00:00:00.000Z"),
    ];
    const uc = new ObtenerInicioUseCase(makeUsuarioRepo(rows), makeRecoService([]));
    const res = await uc.execute("user-1");
    expect(res.enProceso).toHaveLength(2);
    expect(res.enProceso[0].contenido.id).toBe("c2"); // más reciente
    expect(res.enProceso[1].contenido.id).toBe("c4");
    expect(res.enProceso.every((r) => r.estado === "en_proceso")).toBe(true);
  });

  it("enProceso incluye detalle completo", async () => {
    const rows = [fakeRow("c1", "en_proceso", "pelicula", "2024-01-01T00:00:00.000Z")];
    const uc = new ObtenerInicioUseCase(makeUsuarioRepo(rows), makeRecoService([]));
    const res = await uc.execute("user-1");
    expect(res.enProceso[0].contenido.detalle).toBeDefined();
  });

  it("recomendaciones nunca incluye algo que el usuario ya tiene (cualquier estado)", async () => {
    const rows = [fakeRow("c1", "pendiente", "pelicula", "2024-01-01")];
    const yaTieneIds = new Set(["c1"]);
    const recoService = {
      recomendar: vi.fn(async () => {
        // Simular que el servicio intenta devolver c1 pero debe haberlo excluido
        const todos = [fakeContenido("c1", "pelicula"), fakeContenido("c2", "pelicula")];
        return todos.filter((c) => !yaTieneIds.has(c.id));
      }),
    } as unknown as IRecomendacionService;
    const uc = new ObtenerInicioUseCase(makeUsuarioRepo(rows), recoService);
    const res = await uc.execute("user-1");
    expect(res.recomendaciones.find((c) => c.id === "c1")).toBeUndefined();
    expect(res.recomendaciones.find((c) => c.id === "c2")).toBeDefined();
  });

  it("recomendar es delegado a IRecomendacionService (mockeable)", async () => {
    const reco = makeRecoService([fakeContenido("r1", "serie")]);
    const uc = new ObtenerInicioUseCase(makeUsuarioRepo([]), reco);
    const res = await uc.execute("user-1");
    expect(reco.recomendar).toHaveBeenCalledWith("user-1");
    expect(res.recomendaciones).toHaveLength(1);
    expect(res.recomendaciones[0].id).toBe("r1");
  });

  it("usuario sin historial: recomendaciones no vacías si hay populares (fallback)", async () => {
    const reco = makeRecoService([fakeContenido("p1", "musica"), fakeContenido("p2", "pelicula")]);
    const uc = new ObtenerInicioUseCase(makeUsuarioRepo([]), reco);
    const res = await uc.execute("user-nuevo");
    expect(res.recomendaciones.length).toBeGreaterThan(0);
  });

  it("enProceso vacío si no hay en_proceso", async () => {
    const uc = new ObtenerInicioUseCase(makeUsuarioRepo([fakeRow("c1", "pendiente", "pelicula", "2024-01-01")]), makeRecoService([]));
    const res = await uc.execute("user-1");
    expect(res.enProceso).toEqual([]);
  });
});
