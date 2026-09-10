import { describe, it, expect, vi } from "vitest";
import { ObtenerContenidoDetalleUseCase } from "@/application/use-cases/ObtenerContenidoDetalle";
import type { IContenidoRepository } from "@/domain/repositories/IContenidoRepository";
import type { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";

function makeFakeContenidoRepo() {
  const contenidos = new Map<string, unknown>([
    [
      "cont-1",
      {
        id: "cont-1",
        tipo: "pelicula",
        titulo: "Matrix",
        imagenUrl: null,
        fuenteExterna: "tmdb",
        idExterno: "603",
        fechaAnadido: new Date("2024-01-01"),
        detalle: { _tipo: "pelicula", anio: 1999 },
      },
    ],
  ]);
  return {
    findByFuenteExternaAndIdExterno: vi.fn(),
    findById: vi.fn(),
    findByIdConDetalle: vi.fn(async (id: string) => contenidos.get(id) ?? null) as unknown as IContenidoRepository["findByIdConDetalle"],
    findByIdConDetalleYEstado: vi.fn(),
    create: vi.fn(),
  } as unknown as IContenidoRepository;
}

function makeFakeUsuarioRepo(estado: string | null = null) {
  return {
    find: vi.fn(async () => (estado ? { estado: estado as never, fechaActualizacion: new Date() } : null)),
    exists: vi.fn(async () => !!estado),
    create: vi.fn(),
  } as unknown as IUsuarioContenidoRepository;
}

describe("ObtenerContenidoDetalleUseCase", () => {
  it("devuelve contenido + estadoUsuario cuando lo tiene", async () => {
    const contenidoRepo = makeFakeContenidoRepo();
    const usuarioRepo = makeFakeUsuarioRepo("pendiente");
    const uc = new ObtenerContenidoDetalleUseCase(contenidoRepo, usuarioRepo);
    const res = await uc.execute("user-1", "cont-1");
    expect(res.contenido.id).toBe("cont-1");
    expect(res.estadoUsuario).toBe("pendiente");
    expect(res.contenido.detalle).toEqual(expect.objectContaining({ _tipo: "pelicula" }));
  });

  it("devuelve estadoUsuario null si no lo tiene", async () => {
    const contenidoRepo = makeFakeContenidoRepo();
    const usuarioRepo = makeFakeUsuarioRepo(null);
    const uc = new ObtenerContenidoDetalleUseCase(contenidoRepo, usuarioRepo);
    const res = await uc.execute("user-1", "cont-1");
    expect(res.estadoUsuario).toBeNull();
    expect(res.contenido.id).toBe("cont-1");
  });

  it("404 si contenido no existe", async () => {
    const contenidoRepo = makeFakeContenidoRepo();
    const usuarioRepo = makeFakeUsuarioRepo(null);
    const uc = new ObtenerContenidoDetalleUseCase(contenidoRepo, usuarioRepo);
    await expect(uc.execute("user-1", "nope")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("401 sin usuarioId", async () => {
    const contenidoRepo = makeFakeContenidoRepo();
    const usuarioRepo = makeFakeUsuarioRepo(null);
    const uc = new ObtenerContenidoDetalleUseCase(contenidoRepo, usuarioRepo);
    await expect(uc.execute("", "cont-1")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("distingue estados en_proceso/visto", async () => {
    const contenidoRepo = makeFakeContenidoRepo();
    for (const estado of ["en_proceso", "visto"] as const) {
      const usuarioRepo = makeFakeUsuarioRepo(estado);
      const uc = new ObtenerContenidoDetalleUseCase(contenidoRepo, usuarioRepo);
      const res = await uc.execute("user-1", "cont-1");
      expect(res.estadoUsuario).toBe(estado);
    }
  });
});
