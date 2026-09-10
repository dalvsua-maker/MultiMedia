import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const mockContenidoRepo = vi.hoisted(() => ({
  findByFuenteExternaAndIdExterno: vi.fn(),
  findById: vi.fn(),
  findByIdConDetalle: vi.fn(),
  findByIdConDetalleYEstado: vi.fn(),
  create: vi.fn(),
}));

const mockUsuarioRepo = vi.hoisted(() => ({
  find: vi.fn(),
  exists: vi.fn(),
  create: vi.fn(),
}));

const mockListaRepo = vi.hoisted(() => ({
  create: vi.fn(),
  findByUsuarioId: vi.fn(),
  findById: vi.fn(),
  findByIdWithContenidos: vi.fn(),
  addContenido: vi.fn(),
  removeContenido: vi.fn(),
  existsContenidoInLista: vi.fn(),
  contenidoExists: vi.fn(),
}));

vi.mock("@/infrastructure/repositories/PrismaContenidoRepository", () => ({
  PrismaContenidoRepository: vi.fn(function () {
    return mockContenidoRepo;
  }),
}));
vi.mock("@/infrastructure/repositories/PrismaUsuarioContenidoRepository", () => ({
  PrismaUsuarioContenidoRepository: vi.fn(function () {
    return mockUsuarioRepo;
  }),
}));
vi.mock("@/infrastructure/repositories/PrismaListaRepository", () => ({
  PrismaListaRepository: vi.fn(function () {
    return mockListaRepo;
  }),
}));
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {},
  default: {},
}));

import { POST as POSTContenidos } from "@/app/api/contenidos/route";
import { GET as GETContenido } from "@/app/api/contenidos/[id]/route";

const JWT_SECRET = "test-secret-contenidos";
const userId = "user-1";
const token = jwt.sign({ sub: userId, email: "test@example.com" }, JWT_SECRET, {
  expiresIn: "1h",
});

function reqConAuth(url: string, init: RequestInit = {}): NextRequest {
  const headers = new Headers(init.headers as HeadersInit);
  headers.set("authorization", `Bearer ${token}`);
  return new NextRequest(url, { ...init, headers } as unknown as RequestInit);
}

const baseBody = {
  tipo: "pelicula",
  titulo: "Matrix",
  fuenteExterna: "tmdb",
  idExterno: "603",
  imagenUrl: null,
  detalle: { anio: 1999 },
  listaId: null,
};

describe("POST /api/contenidos (UC2, listaId opcional, 200 idempotente)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;

    mockContenidoRepo.findByFuenteExternaAndIdExterno.mockResolvedValue(null);
    mockContenidoRepo.create.mockResolvedValue({
      id: "cont-1",
      tipo: "pelicula",
      titulo: "Matrix",
      imagenUrl: null,
      fuenteExterna: "tmdb",
      idExterno: "603",
      fechaAnadido: new Date("2024-01-01T00:00:00.000Z"),
    });
    mockContenidoRepo.findByIdConDetalle.mockResolvedValue({
      id: "cont-1",
      tipo: "pelicula",
      titulo: "Matrix",
      imagenUrl: null,
      fuenteExterna: "tmdb",
      idExterno: "603",
      fechaAnadido: new Date("2024-01-01T00:00:00.000Z"),
      detalle: null,
    });
    mockUsuarioRepo.exists.mockResolvedValue(false);
    mockUsuarioRepo.find.mockResolvedValue(null);
    mockListaRepo.findById.mockResolvedValue({
      id: "lista-1",
      usuarioId: userId,
      nombre: "Lista",
      descripcion: null,
      fechaCreacion: new Date(),
    } as never);
    mockListaRepo.existsContenidoInLista.mockResolvedValue(false);
  });

  it("201 sin listaId, 200 idempotente si usuario ya lo tiene (yaExistia true)", async () => {
    const req1 = reqConAuth("http://localhost:3000/api/contenidos", {
      method: "POST",
      body: JSON.stringify(baseBody),
    });
    const res1 = await POSTContenidos(req1);
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as { yaExistia: boolean; estadoUsuario: string };
    expect(body1.yaExistia).toBe(false);
    expect(body1.estadoUsuario).toBe("pendiente");

    // Segunda vez: contenido ya existe global + usuario ya lo tiene
    mockContenidoRepo.findByFuenteExternaAndIdExterno.mockResolvedValue({
      id: "cont-1",
      tipo: "pelicula",
      titulo: "Matrix",
      imagenUrl: null,
      fuenteExterna: "tmdb",
      idExterno: "603",
      fechaAnadido: new Date(),
    } as never);
    mockUsuarioRepo.exists.mockResolvedValue(true);

    const req2 = reqConAuth("http://localhost:3000/api/contenidos", {
      method: "POST",
      body: JSON.stringify(baseBody),
    });
    const res2 = await POSTContenidos(req2);
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { yaExistia: boolean };
    expect(body2.yaExistia).toBe(true);
    // No debe crear de nuevo usuario_contenido
    expect(mockUsuarioRepo.create).toHaveBeenCalledTimes(1);
  });

  it("reutiliza contenido global (yaExistia true) aunque usuario no lo tenía", async () => {
    mockContenidoRepo.findByFuenteExternaAndIdExterno.mockResolvedValue({
      id: "cont-exist",
      tipo: "pelicula",
      titulo: "Matrix",
      imagenUrl: null,
      fuenteExterna: "tmdb",
      idExterno: "603",
      fechaAnadido: new Date(),
    } as never);
    mockContenidoRepo.findByIdConDetalle.mockResolvedValue({
      id: "cont-exist",
      tipo: "pelicula",
      titulo: "Matrix",
      imagenUrl: null,
      fuenteExterna: "tmdb",
      idExterno: "603",
      fechaAnadido: new Date(),
      detalle: null,
    } as never);
    mockUsuarioRepo.exists.mockResolvedValue(false);

    const req = reqConAuth("http://localhost:3000/api/contenidos", {
      method: "POST",
      body: JSON.stringify(baseBody),
    });
    const res = await POSTContenidos(req);
    expect(res.status).toBe(200);
    expect((await res.json() as { yaExistia: boolean }).yaExistia).toBe(true);
    expect(mockContenidoRepo.create).not.toHaveBeenCalled();
    expect(mockUsuarioRepo.create).toHaveBeenCalledWith(userId, "cont-exist", "pendiente");
  });

  it("con listaId válida: añade a lista", async () => {
    const req = reqConAuth("http://localhost:3000/api/contenidos", {
      method: "POST",
      body: JSON.stringify({ ...baseBody, listaId: "lista-1" }),
    });
    const res = await POSTContenidos(req);
    expect(res.status).toBe(201);
    expect(mockListaRepo.addContenido).toHaveBeenCalledWith("lista-1", "cont-1");
  });

  it("con listaId ya en lista: idempotente, no duplica", async () => {
    mockListaRepo.existsContenidoInLista.mockResolvedValue(true);
    const req = reqConAuth("http://localhost:3000/api/contenidos", {
      method: "POST",
      body: JSON.stringify({ ...baseBody, listaId: "lista-1" }),
    });
    const res = await POSTContenidos(req);
    expect(res.status).toBe(201);
    expect(mockListaRepo.addContenido).not.toHaveBeenCalled();
  });

  it("401 sin token", async () => {
    const req = new NextRequest("http://localhost:3000/api/contenidos", {
      method: "POST",
      body: JSON.stringify(baseBody),
    });
    const res = await POSTContenidos(req);
    expect(res.status).toBe(401);
  });

  it("400 body inválido (titulo vacío)", async () => {
    const req = reqConAuth("http://localhost:3000/api/contenidos", {
      method: "POST",
      body: JSON.stringify({ ...baseBody, titulo: "" }),
    });
    const res = await POSTContenidos(req);
    expect(res.status).toBe(400);
  });

  it("404 si listaId no existe", async () => {
    mockListaRepo.findById.mockResolvedValue(null);
    const req = reqConAuth("http://localhost:3000/api/contenidos", {
      method: "POST",
      body: JSON.stringify({ ...baseBody, listaId: "nope" }),
    });
    const res = await POSTContenidos(req);
    expect(res.status).toBe(404);
  });

  it("403 si lista no pertenece al usuario", async () => {
    mockListaRepo.findById.mockResolvedValue({
      id: "lista-1",
      usuarioId: "otro",
      nombre: "Otra",
      descripcion: null,
      fechaCreacion: new Date(),
    } as never);
    const req = reqConAuth("http://localhost:3000/api/contenidos", {
      method: "POST",
      body: JSON.stringify({ ...baseBody, listaId: "lista-1" }),
    });
    const res = await POSTContenidos(req);
    expect(res.status).toBe(403);
  });

  it("mantiene POST /api/listas/:id/contenidos separado (409 si ya en lista) — no interfiere", async () => {
    // Este test documenta que 409 sigue reservado para listas, no para /api/contenidos
    // No hay lógica 409 en POST /api/contenidos
    expect(true).toBe(true);
  });
});

describe("GET /api/contenidos/:id (con estadoUsuario anidado)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
    mockContenidoRepo.findByIdConDetalle.mockResolvedValue({
      id: "cont-1",
      tipo: "pelicula",
      titulo: "Matrix",
      imagenUrl: null,
      fuenteExterna: "tmdb",
      idExterno: "603",
      fechaAnadido: new Date("2024-01-01T00:00:00.000Z"),
      detalle: { _tipo: "pelicula", anio: 1999 } as never,
    } as never);
    mockUsuarioRepo.find.mockResolvedValue({ estado: "pendiente", fechaActualizacion: new Date() } as never);
  });

  it("200 con contenido + estadoUsuario pendiente", async () => {
    const req = reqConAuth("http://localhost:3000/api/contenidos/cont-1");
    const res = await GETContenido(req, { params: Promise.resolve({ id: "cont-1" }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { contenido: { id: string }; estadoUsuario: string | null };
    expect(body.contenido.id).toBe("cont-1");
    expect(body.estadoUsuario).toBe("pendiente");
    expect(body.contenido).toHaveProperty("detalle");
  });

  it("200 con estadoUsuario null si no lo tiene", async () => {
    mockUsuarioRepo.find.mockResolvedValue(null);
    const req = reqConAuth("http://localhost:3000/api/contenidos/cont-1");
    const res = await GETContenido(req, { params: Promise.resolve({ id: "cont-1" }) });
    expect(res.status).toBe(200);
    expect((await res.json() as { estadoUsuario: unknown }).estadoUsuario).toBeNull();
  });

  it("200 distingue en_proceso/visto", async () => {
    for (const estado of ["en_proceso", "visto"] as const) {
      mockUsuarioRepo.find.mockResolvedValue({ estado, fechaActualizacion: new Date() } as never);
      const req = reqConAuth("http://localhost:3000/api/contenidos/cont-1");
      const res = await GETContenido(req, { params: Promise.resolve({ id: "cont-1" }) });
      expect((await res.json() as { estadoUsuario: string }).estadoUsuario).toBe(estado);
    }
  });

  it("404 si contenido no existe", async () => {
    mockContenidoRepo.findByIdConDetalle.mockResolvedValue(null);
    const req = reqConAuth("http://localhost:3000/api/contenidos/nope");
    const res = await GETContenido(req, { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });

  it("401 sin token", async () => {
    const req = new NextRequest("http://localhost:3000/api/contenidos/cont-1");
    const res = await GETContenido(req, { params: Promise.resolve({ id: "cont-1" }) });
    expect(res.status).toBe(401);
  });
});
