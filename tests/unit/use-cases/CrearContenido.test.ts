import { describe, it, expect, beforeEach, vi } from "vitest";
import { CrearContenidoUseCase } from "@/application/use-cases/CrearContenido";
import type { IContenidoRepository } from "@/domain/repositories/IContenidoRepository";
import type { IUsuarioContenidoRepository } from "@/domain/repositories/IUsuarioContenidoRepository";
import type { IListaRepository } from "@/domain/repositories/IListaRepository";
import { Contenido } from "@/domain/entities/Contenido";

class FakeContenidoRepo implements IContenidoRepository {
  contenidos = new Map<string, Contenido>();
  nextId = 1;
  // key: fuente:idExterno
  findByFuenteExternaAndIdExterno = vi.fn(
    async (fuente: string, idExterno: string) => {
      for (const c of this.contenidos.values()) {
        if (c.fuenteExterna === fuente && c.idExterno === idExterno) return c;
      }
      return null;
    }
  );
  findById = vi.fn(async (id: string) => this.contenidos.get(id) ?? null);
  findByIdConDetalle = vi.fn(async (id: string) => {
    const c = this.contenidos.get(id);
    if (!c) return null;
    return {
      id: c.id,
      tipo: c.tipo,
      titulo: c.titulo,
      imagenUrl: c.imagenUrl,
      fuenteExterna: c.fuenteExterna,
      idExterno: c.idExterno,
      fechaAnadido: c.fechaAnadido,
      detalle: null,
    };
  });
  findByIdConDetalleYEstado = vi.fn(async () => null);
  create = vi.fn(async (data: never) => {
    const c = new Contenido({
      id: `cont-${this.nextId++}`,
      tipo: data.tipo,
      titulo: data.titulo,
      imagenUrl: data.imagenUrl ?? null,
      fuenteExterna: data.fuenteExterna,
      idExterno: data.idExterno,
      fechaAnadido: new Date(),
    });
    this.contenidos.set(c.id, c);
    // key for reuse
    return c;
  });
}

class FakeUsuarioContenidoRepo implements IUsuarioContenidoRepository {
  set = new Set<string>(); // usuarioId:contenidoId
  find = vi.fn(async (u: string, c: string) => {
    const key = `${u}:${c}`;
    return this.set.has(key) ? { estado: "pendiente" as const, fechaActualizacion: new Date() } : null;
  });
  exists = vi.fn(async (u: string, c: string) => this.set.has(`${u}:${c}`));
  create = vi.fn(async (u: string, c: string) => {
    this.set.add(`${u}:${c}`);
  });
}

class FakeListaRepo implements IListaRepository {
  listas = new Map<string, { id: string; usuarioId: string }>([
    ["lista-1", { id: "lista-1", usuarioId: "user-1" }],
    ["lista-2", { id: "lista-2", usuarioId: "user-2" }],
  ]);
  listaContenidos = new Set<string>(); // listaId:contenidoId

  create = vi.fn(async () => null as never);
  findByUsuarioId = vi.fn(async () => []);
  findById = vi.fn(async (id: string) => {
    const l = this.listas.get(id);
    if (!l) return null;
    return {
      id: l.id,
      usuarioId: l.usuarioId,
      nombre: "Lista",
      descripcion: null,
      fechaCreacion: new Date(),
    } as never;
  });
  findByIdWithContenidos = vi.fn(async () => null);
  addContenido = vi.fn(async (listaId: string, contenidoId: string) => {
    this.listaContenidos.add(`${listaId}:${contenidoId}`);
  });
  removeContenido = vi.fn(async () => {});
  existsContenidoInLista = vi.fn(
    async (listaId: string, contenidoId: string) => this.listaContenidos.has(`${listaId}:${contenidoId}`)
  );
  contenidoExists = vi.fn(async () => true);
}

describe("CrearContenidoUseCase (UC2)", () => {
  let contenidoRepo: FakeContenidoRepo;
  let usuarioRepo: FakeUsuarioContenidoRepo;
  let listaRepo: FakeListaRepo;

  beforeEach(() => {
    contenidoRepo = new FakeContenidoRepo();
    usuarioRepo = new FakeUsuarioContenidoRepo();
    listaRepo = new FakeListaRepo();
  });

  const baseDto = {
    tipo: "pelicula" as const,
    titulo: "Matrix",
    fuenteExterna: "tmdb" as const,
    idExterno: "603",
    imagenUrl: null,
    detalle: null,
    listaId: null,
  };

  it("crea contenido nuevo, usuario_contenido pendiente, yaExistia false", async () => {
    const uc = new CrearContenidoUseCase(contenidoRepo, usuarioRepo, listaRepo);
    const res = await uc.execute("user-1", baseDto);
    expect(res.yaExistia).toBe(false);
    expect(res.estadoUsuario).toBe("pendiente");
    expect(res.contenido.titulo).toBe("Matrix");
    expect(contenidoRepo.create).toHaveBeenCalledOnce();
    expect(usuarioRepo.create).toHaveBeenCalledWith("user-1", expect.any(String), "pendiente");
  });

  it("reutiliza contenido global existente (no crea de nuevo), yaExistia true", async () => {
    const uc = new CrearContenidoUseCase(contenidoRepo, usuarioRepo, listaRepo);
    const r1 = await uc.execute("user-1", baseDto);
    const r2 = await uc.execute("user-2", baseDto);
    expect(contenidoRepo.create).toHaveBeenCalledTimes(1);
    expect(r2.yaExistia).toBe(true);
    expect(r2.contenido.id).toBe(r1.contenido.id);
  });

  it("idempotente 200 si usuario ya tiene el contenido (no duplica, no 409)", async () => {
    const uc = new CrearContenidoUseCase(contenidoRepo, usuarioRepo, listaRepo);
    const r1 = await uc.execute("user-1", baseDto);
    const r2 = await uc.execute("user-1", baseDto);
    expect(r1.contenido.id).toBe(r2.contenido.id);
    expect(r2.yaExistia).toBe(true);
    // usuario_contenido create solo 1 vez
    expect(usuarioRepo.create).toHaveBeenCalledTimes(1);
  });

  it("con listaId válida: crea contenido y añade a lista", async () => {
    const uc = new CrearContenidoUseCase(contenidoRepo, usuarioRepo, listaRepo);
    const res = await uc.execute("user-1", { ...baseDto, listaId: "lista-1" });
    expect(res.contenido.id).toBeDefined();
    expect(listaRepo.addContenido).toHaveBeenCalledWith("lista-1", res.contenido.id);
  });

  it("con listaId reutilizando contenido: añade a lista si no estaba", async () => {
    const uc = new CrearContenidoUseCase(contenidoRepo, usuarioRepo, listaRepo);
    const r1 = await uc.execute("user-1", baseDto); // sin lista
    const r2 = await uc.execute("user-1", { ...baseDto, listaId: "lista-1" });
    expect(r1.contenido.id).toBe(r2.contenido.id);
    expect(listaRepo.addContenido).toHaveBeenCalledWith("lista-1", r1.contenido.id);
  });

  it("con listaId ya en lista: idempotente, no duplica lista_contenido", async () => {
    const uc = new CrearContenidoUseCase(contenidoRepo, usuarioRepo, listaRepo);
    await uc.execute("user-1", { ...baseDto, listaId: "lista-1" });
    vi.clearAllMocks();
    contenidoRepo.findByFuenteExternaAndIdExterno = vi.fn(async () => {
      for (const c of contenidoRepo.contenidos.values()) return c;
      return null;
    });
    // Segunda vez ya está en lista, addContenido no debe llamarse de nuevo si ya existe
    // Pero nuestro fake ya tiene el set, así que existsContenidoInLista true
    listaRepo.listaContenidos.add(`lista-1:${[...contenidoRepo.contenidos.values()][0].id}`);
    const res = await uc.execute("user-1", { ...baseDto, listaId: "lista-1" });
    expect(res.yaExistia).toBe(true);
    // addContenido no debe llamarse porque ya está
    expect(listaRepo.addContenido).not.toHaveBeenCalled();
  });

  it("falla 404 si listaId no existe", async () => {
    const uc = new CrearContenidoUseCase(contenidoRepo, usuarioRepo, listaRepo);
    await expect(uc.execute("user-1", { ...baseDto, listaId: "nope" })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("falla 403 si lista no pertenece al usuario", async () => {
    const uc = new CrearContenidoUseCase(contenidoRepo, usuarioRepo, listaRepo);
    await expect(uc.execute("user-1", { ...baseDto, listaId: "lista-2" })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("falla 400 si dto inválido (titulo vacío, tipo inválido)", async () => {
    const uc = new CrearContenidoUseCase(contenidoRepo, usuarioRepo, listaRepo);
    await expect(uc.execute("user-1", { ...baseDto, titulo: "" })).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(
      // @ts-expect-error tipo invalido
      uc.execute("user-1", { ...baseDto, tipo: "libro" })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("falla 401 sin usuarioId", async () => {
    const uc = new CrearContenidoUseCase(contenidoRepo, usuarioRepo, listaRepo);
    await expect(uc.execute("", baseDto)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("crea detalle según tipo", async () => {
    const uc = new CrearContenidoUseCase(contenidoRepo, usuarioRepo, listaRepo);
    const res = await uc.execute("user-1", {
      tipo: "videojuego",
      titulo: "Zelda",
      fuenteExterna: "igdb",
      idExterno: "123",
      detalle: { plataformas: ["Switch"], desarrollador: "Nintendo", anioLanzamiento: 2017 },
      listaId: null,
      imagenUrl: null,
    });
    expect(res.contenido.detalle).toEqual(
      expect.objectContaining({ _tipo: "videojuego", plataformas: ["Switch"] })
    );
  });
});
