import { describe, it, expect, vi, beforeEach } from "vitest";
import { ListarUsuarioContenidosUseCase } from "@/application/use-cases/ListarUsuarioContenidos";
import { ActualizarEstadoUseCase } from "@/application/use-cases/ActualizarEstado";
import type {
  IUsuarioContenidoRepository,
  UsuarioContenidoConDetalles,
} from "@/domain/repositories/IUsuarioContenidoRepository";

function makeRepo(
  overrides: Partial<IUsuarioContenidoRepository> = {}
): IUsuarioContenidoRepository & Record<string, ReturnType<typeof vi.fn>> {
  return {
    find: vi.fn(),
    exists: vi.fn(),
    create: vi.fn(),
    findAllByUsuarioId: vi.fn(async () => []),
    updateEstado: vi.fn(async () => {}),
    ...overrides,
  } as never;
}

function fakeRow(estado: string): UsuarioContenidoConDetalles {
  return {
    contenido: {
      id: `cont-${estado}`,
      tipo: "pelicula",
      titulo: "Matrix",
      imagenUrl: null,
      fuenteExterna: "tmdb",
      idExterno: "603",
      fechaAnadido: new Date("2024-01-01"),
      detalle: null,
    },
    estado: estado as never,
    fechaActualizacion: new Date(),
  };
}

describe("ListarUsuarioContenidosUseCase", () => {
  it("401 sin usuarioId", async () => {
    const repo = makeRepo();
    const uc = new ListarUsuarioContenidosUseCase(repo);
    await expect(uc.execute("")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("devuelve lista vacía si no tiene contenidos", async () => {
    const repo = makeRepo();
    const uc = new ListarUsuarioContenidosUseCase(repo);
    const res = await uc.execute("user-1");
    expect(res.total).toBe(0);
    expect(res.contenidos).toEqual([]);
  });

  it("devuelve contenidos con estado y detalle", async () => {
    const repo = makeRepo({
      findAllByUsuarioId: vi.fn(async () => [fakeRow("pendiente"), fakeRow("visto")]),
    });
    const uc = new ListarUsuarioContenidosUseCase(repo);
    const res = await uc.execute("user-1");
    expect(res.total).toBe(2);
    expect(res.contenidos[0].estado).toBe("pendiente");
    expect(res.contenidos[1].estado).toBe("visto");
  });
});

describe("ActualizarEstadoUseCase", () => {
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo();
  });

  it("401 sin usuarioId", async () => {
    const uc = new ActualizarEstadoUseCase(repo);
    await expect(uc.execute("", "cont-1", "en_proceso")).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("400 si contenidoId vacío", async () => {
    const uc = new ActualizarEstadoUseCase(repo);
    await expect(uc.execute("user-1", "", "en_proceso")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("400 si estado inválido", async () => {
    const uc = new ActualizarEstadoUseCase(repo);
    await expect(uc.execute("user-1", "cont-1", "otro")).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(uc.execute("user-1", "cont-1", "")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("404 si contenido no está en cuenta", async () => {
    repo.find = vi.fn(async () => null);
    const uc = new ActualizarEstadoUseCase(repo);
    await expect(uc.execute("user-1", "cont-1", "en_proceso")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("idempotente: mismo estado no lanza 409 y no actualiza", async () => {
    repo.find = vi.fn(async () => ({ estado: "pendiente", fechaActualizacion: new Date() } as never));
    const uc = new ActualizarEstadoUseCase(repo);
    const res = await uc.execute("user-1", "cont-1", "pendiente");
    expect(res.estado).toBe("pendiente");
    expect(repo.updateEstado).not.toHaveBeenCalled();
  });

  it("permite pendiente -> en_proceso", async () => {
    repo.find = vi.fn(async () => ({ estado: "pendiente", fechaActualizacion: new Date() } as never));
    const uc = new ActualizarEstadoUseCase(repo);
    const res = await uc.execute("user-1", "cont-1", "en_proceso");
    expect(res.estado).toBe("en_proceso");
    expect(repo.updateEstado).toHaveBeenCalledWith("user-1", "cont-1", "en_proceso");
  });

  it("permite en_proceso -> visto", async () => {
    repo.find = vi.fn(async () => ({ estado: "en_proceso", fechaActualizacion: new Date() } as never));
    const uc = new ActualizarEstadoUseCase(repo);
    const res = await uc.execute("user-1", "cont-1", "visto");
    expect(res.estado).toBe("visto");
  });

  it("permite retroceso libre pendiente->visto (ahora 200)", async () => {
    repo.find = vi.fn(async () => ({ estado: "pendiente", fechaActualizacion: new Date() } as never));
    const uc = new ActualizarEstadoUseCase(repo);
    const res = await uc.execute("user-1", "cont-1", "visto");
    expect(res.estado).toBe("visto");
    expect(repo.updateEstado).toHaveBeenCalledWith("user-1", "cont-1", "visto");
  });

  it("permite retroceso en_proceso -> pendiente (ahora 200)", async () => {
    repo.find = vi.fn(async () => ({ estado: "en_proceso", fechaActualizacion: new Date() } as never));
    const uc = new ActualizarEstadoUseCase(repo);
    const res = await uc.execute("user-1", "cont-1", "pendiente");
    expect(res.estado).toBe("pendiente");
    expect(repo.updateEstado).toHaveBeenCalledWith("user-1", "cont-1", "pendiente");
  });

  it("permite retroceso visto -> cualquier otro (ahora 200)", async () => {
    repo.find = vi.fn(async () => ({ estado: "visto", fechaActualizacion: new Date() } as never));
    const uc = new ActualizarEstadoUseCase(repo);
    const res1 = await uc.execute("user-1", "cont-1", "pendiente");
    expect(res1.estado).toBe("pendiente");
    repo.find = vi.fn(async () => ({ estado: "visto", fechaActualizacion: new Date() } as never));
    const res2 = await uc.execute("user-1", "cont-1", "en_proceso");
    expect(res2.estado).toBe("en_proceso");
  });
});
