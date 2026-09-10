import { describe, it, expect, vi } from "vitest";
import { BuscarUsuariosUseCase } from "@/application/use-cases/BuscarUsuarios";
import { CompartirContenidoUseCase } from "@/application/use-cases/CompartirContenido";
import { ListarComparticionesUseCase } from "@/application/use-cases/ListarComparticiones";
import { ResponderComparticionUseCase } from "@/application/use-cases/ResponderComparticion";
import { ObtenerContenidoPublicoUseCase } from "@/application/use-cases/ObtenerContenidoPublico";
import type { IUsuarioRepository } from "@/domain/repositories/IUsuarioRepository";
import type { IContenidoRepository } from "@/domain/repositories/IContenidoRepository";
import type { IComparticionRepository } from "@/domain/repositories/IComparticionRepository";
import type { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";
import { Contenido } from "@/domain/entities/Contenido";

function makeUsuarioRepo(overrides: Partial<IUsuarioRepository> = {}) {
  return {
    findByEmail: vi.fn(),
    findById: vi.fn(async (id: string) => (id === "u2" ? ({ id: "u2", nombre: "Bob" } as never) : null)),
    create: vi.fn(),
    buscarPorNombre: vi.fn(async () => []),
    ...overrides,
  } as unknown as IUsuarioRepository & Record<string, ReturnType<typeof vi.fn>>;
}

function makeContenidoRepo(overrides: Partial<IContenidoRepository> = {}) {
  const existente = new Contenido({
    id: "cont-1",
    tipo: "pelicula",
    titulo: "Matrix",
    imagenUrl: null,
    fuenteExterna: "tmdb",
    idExterno: "603",
    fechaAnadido: new Date(),
  });
  return {
    findByFuenteExternaAndIdExterno: vi.fn(),
    findById: vi.fn(async (id: string) => (id === "cont-1" ? existente : null)),
    findByIdConDetalle: vi.fn(async (id: string) =>
      id === "cont-1"
        ? {
            id: "cont-1",
            tipo: "pelicula",
            titulo: "Matrix",
            imagenUrl: null,
            fuenteExterna: "tmdb",
            idExterno: "603",
            fechaAnadido: new Date(),
            detalle: null,
          }
        : null
    ),
    findByIdConDetalleYEstado: vi.fn(),
    create: vi.fn(),
    ...overrides,
  } as unknown as IContenidoRepository & Record<string, ReturnType<typeof vi.fn>>;
}

function makeComparticionRepo(overrides: Partial<IComparticionRepository> = {}) {
  return {
    create: vi.fn(async (data: never) => ({
      id: "comp-1",
      contenidoId: data.contenidoId,
      usuarioOrigenId: data.usuarioOrigenId,
      usuarioDestinoId: data.usuarioDestinoId,
      estado: "pendiente",
      fechaEnvio: new Date(),
    } as never)),
    findPendiente: vi.fn(async () => null),
    findById: vi.fn(),
    findByIdConDetalles: vi.fn(async (id: string) => ({
      id,
      contenidoId: "cont-1",
      usuarioOrigenId: "u1",
      usuarioDestinoId: "u2",
      estado: "pendiente",
      fechaEnvio: new Date(),
      contenido: {
        id: "cont-1",
        titulo: "Matrix",
        imagenUrl: null,
        tipo: "pelicula",
        fuenteExterna: "tmdb",
        idExterno: "603",
      },
      usuarioOrigen: { id: "u1", nombre: "Alice" },
      usuarioDestino: { id: "u2", nombre: "Bob" },
    } as never)),
    findByUsuario: vi.fn(async () => ({ enviadas: [], recibidas: [] })),
    updateFechaEnvio: vi.fn(async (id: string) => ({
      id,
      contenidoId: "cont-1",
      usuarioOrigenId: "u1",
      usuarioDestinoId: "u2",
      estado: "pendiente",
      fechaEnvio: new Date(),
    } as never)),
    updateEstado: vi.fn(async (id: string, estado: string) => ({
      id,
      contenidoId: "cont-1",
      usuarioOrigenId: "u1",
      usuarioDestinoId: "u2",
      estado,
      fechaEnvio: new Date(),
    } as never)),
    ...overrides,
  } as unknown as IComparticionRepository & Record<string, ReturnType<typeof vi.fn>>;
}

function makeUsuarioContenidoRepo(overrides: Partial<IUsuarioContenidoRepository> = {}) {
  return {
    find: vi.fn(),
    exists: vi.fn(async () => false),
    create: vi.fn(),
    findAllByUsuarioId: vi.fn(),
    updateEstado: vi.fn(),
    ...overrides,
  } as unknown as IUsuarioContenidoRepository & Record<string, ReturnType<typeof vi.fn>>;
}

describe("ObtenerContenidoPublicoUseCase (Vía 1)", () => {
  it("200 si existe", async () => {
    const repo = makeContenidoRepo();
    const uc = new ObtenerContenidoPublicoUseCase(repo);
    const res = await uc.execute("cont-1");
    expect(res.id).toBe("cont-1");
    expect(res.titulo).toBe("Matrix");
    expect((res as unknown as { estadoUsuario?: unknown }).estadoUsuario).toBeUndefined();
  });

  it("404 si no existe", async () => {
    const repo = makeContenidoRepo({
      findByIdConDetalle: vi.fn(async () => null),
    });
    const uc = new ObtenerContenidoPublicoUseCase(repo);
    await expect(uc.execute("nope")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("BuscarUsuariosUseCase (Vía 2)", () => {
  it("401 sin usuarioId", async () => {
    const repo = makeUsuarioRepo();
    const uc = new BuscarUsuariosUseCase(repo);
    await expect(uc.execute("", "ali")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("400 si q <2", async () => {
    const repo = makeUsuarioRepo();
    const uc = new BuscarUsuariosUseCase(repo);
    await expect(uc.execute("u1", "")).rejects.toMatchObject({ statusCode: 400 });
    await expect(uc.execute("u1", "a")).rejects.toMatchObject({ statusCode: 400 });
    await expect(uc.execute("u1", "  a  ")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("excluye al autenticado y limita 10", async () => {
    const repo = makeUsuarioRepo({
      buscarPorNombre: vi.fn(async (q: string, excluido: string, limite?: number) => {
        expect(q).toBe("ali");
        expect(excluido).toBe("u1");
        expect(limite).toBe(10);
        return [{ id: "u2", nombre: "Alice" }];
      }),
    });
    const uc = new BuscarUsuariosUseCase(repo);
    const res = await uc.execute("u1", "  ali  ");
    expect(res).toEqual([{ id: "u2", nombre: "Alice" }]);
  });

  it("no devuelve email", async () => {
    const repo = makeUsuarioRepo({
      buscarPorNombre: vi.fn(async () => [{ id: "u2", nombre: "Bob" } as never]),
    });
    const uc = new BuscarUsuariosUseCase(repo);
    const res = await uc.execute("u1", "bo");
    expect(res[0]).not.toHaveProperty("email");
  });
});

describe("CompartirContenidoUseCase", () => {
  it("401 sin origen", async () => {
    const uc = new CompartirContenidoUseCase(
      makeComparticionRepo(),
      makeContenidoRepo(),
      makeUsuarioRepo()
    );
    await expect(uc.execute("", "cont-1", "u2")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("400 si auto-compartir", async () => {
    const uc = new CompartirContenidoUseCase(
      makeComparticionRepo(),
      makeContenidoRepo(),
      makeUsuarioRepo()
    );
    await expect(uc.execute("u1", "cont-1", "u1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("404 si contenido no existe", async () => {
    const uc = new CompartirContenidoUseCase(
      makeComparticionRepo(),
      makeContenidoRepo({ findById: vi.fn(async () => null) }),
      makeUsuarioRepo()
    );
    await expect(uc.execute("u1", "nope", "u2")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404 si usuario destino no existe", async () => {
    const uc = new CompartirContenidoUseCase(
      makeComparticionRepo(),
      makeContenidoRepo(),
      makeUsuarioRepo({ findById: vi.fn(async () => null) })
    );
    await expect(uc.execute("u1", "cont-1", "u2")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("201 si crea nueva", async () => {
    const compRepo = makeComparticionRepo({ findPendiente: vi.fn(async () => null) });
    const uc = new CompartirContenidoUseCase(compRepo, makeContenidoRepo(), makeUsuarioRepo());
    const res = await uc.execute("u1", "cont-1", "u2");
    expect(res.status).toBe(201);
    expect(compRepo.create).toHaveBeenCalledWith({
      contenidoId: "cont-1",
      usuarioOrigenId: "u1",
      usuarioDestinoId: "u2",
    });
  });

  it("200 si ya existía pendiente (reenvío, actualiza fecha_envio, no duplica)", async () => {
    const compRepo = makeComparticionRepo({
      findPendiente: vi.fn(async () => ({
        id: "comp-pend",
        contenidoId: "cont-1",
        usuarioOrigenId: "u1",
        usuarioDestinoId: "u2",
        estado: "pendiente",
        fechaEnvio: new Date("2024-01-01"),
      } as never)),
    });
    const uc = new CompartirContenidoUseCase(compRepo, makeContenidoRepo(), makeUsuarioRepo());
    const res = await uc.execute("u1", "cont-1", "u2");
    expect(res.status).toBe(200);
    expect(compRepo.updateFechaEnvio).toHaveBeenCalledWith("comp-pend", expect.any(Date));
    expect(compRepo.create).not.toHaveBeenCalled();
  });

  it("201 si anterior estaba rechazada (fila nueva)", async () => {
    const compRepo = makeComparticionRepo({
      findPendiente: vi.fn(async () => null), // no pendiente, aunque haya rechazada
    });
    const uc = new CompartirContenidoUseCase(compRepo, makeContenidoRepo(), makeUsuarioRepo());
    const res = await uc.execute("u1", "cont-1", "u2");
    expect(res.status).toBe(201);
    expect(compRepo.create).toHaveBeenCalled();
  });
});

describe("ListarComparticionesUseCase", () => {
  it("401 sin usuarioId", async () => {
    const uc = new ListarComparticionesUseCase(makeComparticionRepo());
    await expect(uc.execute("")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("devuelve enviadas y recibidas con contenido y nombre", async () => {
    const compRepo = makeComparticionRepo({
      findByUsuario: vi.fn(async () => ({
        enviadas: [
          {
            id: "c1",
            contenidoId: "cont-1",
            usuarioOrigenId: "u1",
            usuarioDestinoId: "u2",
            estado: "pendiente",
            fechaEnvio: new Date(),
            contenido: { id: "cont-1", titulo: "Matrix", imagenUrl: null, tipo: "pelicula", fuenteExterna: "tmdb", idExterno: "603" },
            usuarioOrigen: { id: "u1", nombre: "Alice" },
            usuarioDestino: { id: "u2", nombre: "Bob" },
          } as never,
        ],
        recibidas: [],
      })),
    });
    const uc = new ListarComparticionesUseCase(compRepo);
    const res = await uc.execute("u1");
    expect(res.enviadas).toHaveLength(1);
    expect(res.enviadas[0].usuarioDestino.nombre).toBe("Bob");
  });
});

describe("ResponderComparticionUseCase", () => {
  it("401 sin usuarioId", async () => {
    const uc = new ResponderComparticionUseCase(makeComparticionRepo(), makeUsuarioContenidoRepo());
    await expect(uc.execute("", "comp-1", "aceptar")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("404 si compartición no existe", async () => {
    const compRepo = makeComparticionRepo({ findById: vi.fn(async () => null) });
    const uc = new ResponderComparticionUseCase(compRepo, makeUsuarioContenidoRepo());
    await expect(uc.execute("u2", "nope", "aceptar")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("403 si no es destinatario", async () => {
    const compRepo = makeComparticionRepo({
      findById: vi.fn(async () => ({
        id: "comp-1",
        contenidoId: "cont-1",
        usuarioOrigenId: "u1",
        usuarioDestinoId: "u2",
        estado: "pendiente",
        fechaEnvio: new Date(),
      } as never)),
    });
    const uc = new ResponderComparticionUseCase(compRepo, makeUsuarioContenidoRepo());
    await expect(uc.execute("u1", "comp-1", "aceptar")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("409 si ya no está pendiente", async () => {
    const compRepo = makeComparticionRepo({
      findById: vi.fn(async () => ({
        id: "comp-1",
        contenidoId: "cont-1",
        usuarioOrigenId: "u1",
        usuarioDestinoId: "u2",
        estado: "aceptada",
        fechaEnvio: new Date(),
      } as never)),
    });
    const uc = new ResponderComparticionUseCase(compRepo, makeUsuarioContenidoRepo());
    await expect(uc.execute("u2", "comp-1", "aceptar")).rejects.toMatchObject({ statusCode: 409 });
    await expect(uc.execute("u2", "comp-1", "rechazar")).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rechazar solo actualiza estado a rechazada, sin usuario_contenido", async () => {
    const compRepo = makeComparticionRepo({
      findById: vi.fn(async () => ({
        id: "comp-1",
        contenidoId: "cont-1",
        usuarioOrigenId: "u1",
        usuarioDestinoId: "u2",
        estado: "pendiente",
        fechaEnvio: new Date(),
      } as never)),
      findByIdConDetalles: vi.fn(async () => ({
        id: "comp-1",
        contenidoId: "cont-1",
        usuarioOrigenId: "u1",
        usuarioDestinoId: "u2",
        estado: "rechazada",
        fechaEnvio: new Date(),
        contenido: { id: "cont-1", titulo: "Matrix", imagenUrl: null, tipo: "pelicula", fuenteExterna: "tmdb", idExterno: "603" },
        usuarioOrigen: { id: "u1", nombre: "Alice" },
        usuarioDestino: { id: "u2", nombre: "Bob" },
      } as never)),
    });
    const usuarioRepo = makeUsuarioContenidoRepo();
    const uc = new ResponderComparticionUseCase(compRepo, usuarioRepo);
    const res = await uc.execute("u2", "comp-1", "rechazar");
    expect(res.comparticion.estado).toBe("rechazada");
    expect(res.yaExistia).toBe(false);
    expect(compRepo.updateEstado).toHaveBeenCalledWith("comp-1", "rechazada");
    expect(usuarioRepo.create).not.toHaveBeenCalled();
  });

  it("aceptar crea usuario_contenido pendiente si no lo tenía e idempotente si ya lo tenía", async () => {
    const compRepo = makeComparticionRepo({
      findById: vi.fn(async () => ({
        id: "comp-1",
        contenidoId: "cont-1",
        usuarioOrigenId: "u1",
        usuarioDestinoId: "u2",
        estado: "pendiente",
        fechaEnvio: new Date(),
      } as never)),
      findByIdConDetalles: vi.fn(async () => ({
        id: "comp-1",
        contenidoId: "cont-1",
        usuarioOrigenId: "u1",
        usuarioDestinoId: "u2",
        estado: "aceptada",
        fechaEnvio: new Date(),
        contenido: { id: "cont-1", titulo: "Matrix", imagenUrl: null, tipo: "pelicula", fuenteExterna: "tmdb", idExterno: "603" },
        usuarioOrigen: { id: "u1", nombre: "Alice" },
        usuarioDestino: { id: "u2", nombre: "Bob" },
      } as never)),
    });
    const usuarioRepo = makeUsuarioContenidoRepo({ exists: vi.fn(async () => false) });
    const uc = new ResponderComparticionUseCase(compRepo, usuarioRepo);
    const res1 = await uc.execute("u2", "comp-1", "aceptar");
    expect(res1.comparticion.estado).toBe("aceptada");
    expect(res1.yaExistia).toBe(false);
    expect(usuarioRepo.create).toHaveBeenCalledWith("u2", "cont-1", "pendiente");

    const usuarioRepo2 = makeUsuarioContenidoRepo({ exists: vi.fn(async () => true) });
    const uc2 = new ResponderComparticionUseCase(compRepo, usuarioRepo2);
    const res2 = await uc2.execute("u2", "comp-1", "aceptar");
    expect(res2.comparticion.estado).toBe("aceptada");
    expect(res2.yaExistia).toBe(true);
    expect(usuarioRepo2.create).not.toHaveBeenCalled();
  });

  it("400 si accion inválida", async () => {
    const uc = new ResponderComparticionUseCase(makeComparticionRepo(), makeUsuarioContenidoRepo());
    await expect(uc.execute("u2", "comp-1", "otro")).rejects.toMatchObject({ statusCode: 400 });
  });
});
