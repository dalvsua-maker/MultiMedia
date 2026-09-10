import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

// Mocks
const mockContenidoRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findByIdConDetalle: vi.fn(),
  findByFuenteExternaAndIdExterno: vi.fn(),
  findByIdConDetalleYEstado: vi.fn(),
  create: vi.fn(),
}));

const mockUsuarioRepo = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  buscarPorNombre: vi.fn(),
}));

const mockComparticionRepo = vi.hoisted(() => ({
  create: vi.fn(),
  findPendiente: vi.fn(),
  findById: vi.fn(),
  findByIdConDetalles: vi.fn(),
  findByUsuario: vi.fn(),
  updateFechaEnvio: vi.fn(),
  updateEstado: vi.fn(),
}));

const mockUsuarioContenidoRepo = vi.hoisted(() => ({
  find: vi.fn(),
  exists: vi.fn(),
  create: vi.fn(),
  findAllByUsuarioId: vi.fn(),
  updateEstado: vi.fn(),
}));

vi.mock("@/infrastructure/repositories/PrismaContenidoRepository", () => ({
  PrismaContenidoRepository: vi.fn(function () {
    return mockContenidoRepo;
  }),
}));
vi.mock("@/infrastructure/repositories/PrismaUsuarioRepository", () => ({
  PrismaUsuarioRepository: vi.fn(function () {
    return mockUsuarioRepo;
  }),
}));
vi.mock("@/infrastructure/repositories/PrismaComparticionRepository", () => ({
  PrismaComparticionRepository: vi.fn(function () {
    return mockComparticionRepo;
  }),
}));
vi.mock("@/infrastructure/repositories/PrismaUsuarioContenidoRepository", () => ({
  PrismaUsuarioContenidoRepository: vi.fn(function () {
    return mockUsuarioContenidoRepo;
  }),
}));
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {},
  default: {},
}));

import { GET as GETPublico } from "@/app/api/contenidos/[id]/publico/route";
import { GET as GETUsuariosBuscar } from "@/app/api/usuarios/buscar/route";
import { POST as POSTCompartir, GET as GETComparticiones } from "@/app/api/comparticiones/route";
import { PATCH as PATCHComparticion } from "@/app/api/comparticiones/[id]/route";

const JWT_SECRET = "test-secret-uc5";
const userA = "user-a";
const userB = "user-b";
const tokenA = jwt.sign({ sub: userA, email: "a@test.com" }, JWT_SECRET, { expiresIn: "1h" });
const tokenB = jwt.sign({ sub: userB, email: "b@test.com" }, JWT_SECRET, { expiresIn: "1h" });

function reqConAuth(url: string, token: string, init: RequestInit = {}): NextRequest {
  const headers = new Headers(init.headers as HeadersInit);
  headers.set("authorization", `Bearer ${token}`);
  return new NextRequest(url, { ...init, headers } as unknown as RequestInit);
}

describe("GET /api/contenidos/:id/publico (Vía 1, SIN auth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContenidoRepo.findByIdConDetalle.mockResolvedValue({
      id: "cont-1",
      tipo: "pelicula",
      titulo: "Matrix",
      imagenUrl: null,
      fuenteExterna: "tmdb",
      idExterno: "603",
      fechaAnadido: new Date("2024-01-01"),
      detalle: { _tipo: "pelicula", anio: 1999 } as never,
    } as never);
  });

  it("200 sin auth, expone titulo, tipo, detalle, fuente, no estadoUsuario", async () => {
    const req = new NextRequest("http://localhost:3000/api/contenidos/cont-1/publico");
    const res = await GETPublico(req, { params: Promise.resolve({ id: "cont-1" }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { titulo: string; estadoUsuario?: unknown; idExterno: string };
    expect(body.titulo).toBe("Matrix");
    expect(body.idExterno).toBe("603");
    expect(body.estadoUsuario).toBeUndefined();
  });

  it("404 si contenido no existe", async () => {
    mockContenidoRepo.findByIdConDetalle.mockResolvedValue(null);
    const req = new NextRequest("http://localhost:3000/api/contenidos/nope/publico");
    const res = await GETPublico(req, { params: Promise.resolve({ id: "nope" }) });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/usuarios/buscar (Vía 2, auth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
    mockUsuarioRepo.buscarPorNombre.mockResolvedValue([
      { id: "user-b", nombre: "Bob" },
      { id: "user-c", nombre: "Bobby" },
    ]);
  });

  it("200 con resultados, sin email, límite 10", async () => {
    const req = reqConAuth("http://localhost:3000/api/usuarios/buscar?q=bo", tokenA);
    const res = await GETUsuariosBuscar(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; nombre: string; email?: string }[];
    expect(body).toHaveLength(2);
    expect(body[0]).not.toHaveProperty("email");
    expect(mockUsuarioRepo.buscarPorNombre).toHaveBeenCalledWith("bo", userA, 10);
  });

  it("401 sin token", async () => {
    const req = new NextRequest("http://localhost:3000/api/usuarios/buscar?q=bo");
    const res = await GETUsuariosBuscar(req);
    expect(res.status).toBe(401);
  });

  it("400 si q <2", async () => {
    const req = reqConAuth("http://localhost:3000/api/usuarios/buscar?q=a", tokenA);
    const res = await GETUsuariosBuscar(req);
    expect(res.status).toBe(400);
    const req2 = reqConAuth("http://localhost:3000/api/usuarios/buscar?q=", tokenA);
    expect((await GETUsuariosBuscar(req2)).status).toBe(400);
  });

  it("excluye al autenticado (verificado en repo args)", async () => {
    const req = reqConAuth("http://localhost:3000/api/usuarios/buscar?q=ali", tokenA);
    await GETUsuariosBuscar(req);
    expect(mockUsuarioRepo.buscarPorNombre).toHaveBeenCalledWith("ali", userA, expect.anything());
  });
});

describe("POST /api/comparticiones (Vía 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
    mockContenidoRepo.findById.mockResolvedValue({ id: "cont-1" } as never);
    mockUsuarioRepo.findById.mockResolvedValue({ id: "user-b", nombre: "Bob" } as never);
    mockComparticionRepo.findPendiente.mockResolvedValue(null);
    mockComparticionRepo.create.mockResolvedValue({
      id: "comp-1",
      contenidoId: "cont-1",
      usuarioOrigenId: userA,
      usuarioDestinoId: userB,
      estado: "pendiente",
      fechaEnvio: new Date(),
    } as never);
    mockComparticionRepo.findByIdConDetalles.mockResolvedValue({
      id: "comp-1",
      contenidoId: "cont-1",
      usuarioOrigenId: userA,
      usuarioDestinoId: userB,
      estado: "pendiente",
      fechaEnvio: new Date(),
      contenido: { id: "cont-1", titulo: "Matrix", imagenUrl: null, tipo: "pelicula", fuenteExterna: "tmdb", idExterno: "603" },
      usuarioOrigen: { id: userA, nombre: "Alice" },
      usuarioDestino: { id: userB, nombre: "Bob" },
    } as never);
  });

  it("201 si crea nueva", async () => {
    const req = reqConAuth("http://localhost:3000/api/comparticiones", tokenA, {
      method: "POST",
      body: JSON.stringify({ contenidoId: "cont-1", usuarioDestinoId: userB }),
    });
    const res = await POSTCompartir(req);
    expect(res.status).toBe(201);
  });

  it("200 si ya existía pendiente (reenvío, actualiza fecha)", async () => {
    mockComparticionRepo.findPendiente.mockResolvedValue({
      id: "comp-pend",
      contenidoId: "cont-1",
      usuarioOrigenId: userA,
      usuarioDestinoId: userB,
      estado: "pendiente",
      fechaEnvio: new Date("2024-01-01"),
    } as never);
    mockComparticionRepo.updateFechaEnvio.mockResolvedValue({
      id: "comp-pend",
      contenidoId: "cont-1",
      usuarioOrigenId: userA,
      usuarioDestinoId: userB,
      estado: "pendiente",
      fechaEnvio: new Date(),
    } as never);
    mockComparticionRepo.findByIdConDetalles.mockResolvedValue({
      id: "comp-pend",
      contenidoId: "cont-1",
      usuarioOrigenId: userA,
      usuarioDestinoId: userB,
      estado: "pendiente",
      fechaEnvio: new Date(),
      contenido: { id: "cont-1", titulo: "Matrix", imagenUrl: null, tipo: "pelicula", fuenteExterna: "tmdb", idExterno: "603" },
      usuarioOrigen: { id: userA, nombre: "Alice" },
      usuarioDestino: { id: userB, nombre: "Bob" },
    } as never);

    const req = reqConAuth("http://localhost:3000/api/comparticiones", tokenA, {
      method: "POST",
      body: JSON.stringify({ contenidoId: "cont-1", usuarioDestinoId: userB }),
    });
    const res = await POSTCompartir(req);
    expect(res.status).toBe(200);
    expect(mockComparticionRepo.updateFechaEnvio).toHaveBeenCalled();
    expect(mockComparticionRepo.create).not.toHaveBeenCalled();
  });

  it("201 si anterior estaba rechazada (nueva fila)", async () => {
    // findPendiente null porque no hay pendiente, aunque haya rechazada en DB
    mockComparticionRepo.findPendiente.mockResolvedValue(null);
    const req = reqConAuth("http://localhost:3000/api/comparticiones", tokenA, {
      method: "POST",
      body: JSON.stringify({ contenidoId: "cont-1", usuarioDestinoId: userB }),
    });
    const res = await POSTCompartir(req);
    expect(res.status).toBe(201);
  });

  it("400 si auto-compartir", async () => {
    const req = reqConAuth("http://localhost:3000/api/comparticiones", tokenA, {
      method: "POST",
      body: JSON.stringify({ contenidoId: "cont-1", usuarioDestinoId: userA }),
    });
    const res = await POSTCompartir(req);
    expect(res.status).toBe(400);
  });

  it("404 si contenido no existe", async () => {
    mockContenidoRepo.findById.mockResolvedValue(null);
    const req = reqConAuth("http://localhost:3000/api/comparticiones", tokenA, {
      method: "POST",
      body: JSON.stringify({ contenidoId: "cont-1", usuarioDestinoId: userB }),
    });
    const res = await POSTCompartir(req);
    expect(res.status).toBe(404);
  });

  it("404 si usuario destino no existe", async () => {
    mockUsuarioRepo.findById.mockResolvedValue(null);
    const req = reqConAuth("http://localhost:3000/api/comparticiones", tokenA, {
      method: "POST",
      body: JSON.stringify({ contenidoId: "cont-1", usuarioDestinoId: userB }),
    });
    const res = await POSTCompartir(req);
    expect(res.status).toBe(404);
  });

  it("401 sin token", async () => {
    const req = new NextRequest("http://localhost:3000/api/comparticiones", {
      method: "POST",
      body: JSON.stringify({ contenidoId: "cont-1", usuarioDestinoId: userB }),
    });
    const res = await POSTCompartir(req);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/comparticiones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
    mockComparticionRepo.findByUsuario.mockResolvedValue({
      enviadas: [
        {
          id: "c1",
          contenidoId: "cont-1",
          usuarioOrigenId: userA,
          usuarioDestinoId: userB,
          estado: "pendiente",
          fechaEnvio: new Date(),
          contenido: { id: "cont-1", titulo: "Matrix", imagenUrl: null, tipo: "pelicula", fuenteExterna: "tmdb", idExterno: "603" },
          usuarioOrigen: { id: userA, nombre: "Alice" },
          usuarioDestino: { id: userB, nombre: "Bob" },
        } as never,
      ],
      recibidas: [],
    });
  });

  it("200 {enviadas,recibidas} con nombre y contenido", async () => {
    const req = reqConAuth("http://localhost:3000/api/comparticiones", tokenA);
    const res = await GETComparticiones(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { enviadas: unknown[]; recibidas: unknown[] };
    expect(body.enviadas).toHaveLength(1);
  });

  it("401 sin token", async () => {
    const req = new NextRequest("http://localhost:3000/api/comparticiones");
    const res = await GETComparticiones(req);
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/comparticiones/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
    mockComparticionRepo.findById.mockResolvedValue({
      id: "comp-1",
      contenidoId: "cont-1",
      usuarioOrigenId: userA,
      usuarioDestinoId: userB,
      estado: "pendiente",
      fechaEnvio: new Date(),
    } as never);
    mockComparticionRepo.findByIdConDetalles.mockResolvedValue({
      id: "comp-1",
      contenidoId: "cont-1",
      usuarioOrigenId: userA,
      usuarioDestinoId: userB,
      estado: "aceptada",
      fechaEnvio: new Date(),
      contenido: { id: "cont-1", titulo: "Matrix", imagenUrl: null, tipo: "pelicula", fuenteExterna: "tmdb", idExterno: "603" },
      usuarioOrigen: { id: userA, nombre: "Alice" },
      usuarioDestino: { id: userB, nombre: "Bob" },
    } as never);
    mockComparticionRepo.updateEstado.mockResolvedValue({
      id: "comp-1",
      contenidoId: "cont-1",
      usuarioOrigenId: userA,
      usuarioDestinoId: userB,
      estado: "aceptada",
      fechaEnvio: new Date(),
    } as never);
    mockUsuarioContenidoRepo.exists.mockResolvedValue(false);
    mockUsuarioContenidoRepo.create.mockResolvedValue(undefined);
  });

  it("200 aceptar crea usuario_contenido pendiente", async () => {
    const req = reqConAuth("http://localhost:3000/api/comparticiones/comp-1", tokenB, {
      method: "PATCH",
      body: JSON.stringify({ accion: "aceptar" }),
    });
    const res = await PATCHComparticion(req, { params: Promise.resolve({ id: "comp-1" }) });
    expect(res.status).toBe(200);
    expect(mockUsuarioContenidoRepo.create).toHaveBeenCalledWith(userB, "cont-1", "pendiente");
    expect(mockComparticionRepo.updateEstado).toHaveBeenCalledWith("comp-1", "aceptada");
  });

  it("200 aceptar idempotente si ya lo tenía (no duplica)", async () => {
    mockUsuarioContenidoRepo.exists.mockResolvedValue(true);
    const req = reqConAuth("http://localhost:3000/api/comparticiones/comp-1", tokenB, {
      method: "PATCH",
      body: JSON.stringify({ accion: "aceptar" }),
    });
    const res = await PATCHComparticion(req, { params: Promise.resolve({ id: "comp-1" }) });
    expect(res.status).toBe(200);
    expect(mockUsuarioContenidoRepo.create).not.toHaveBeenCalled();
  });

  it("200 rechazar solo cambia estado, sin usuario_contenido", async () => {
    mockComparticionRepo.updateEstado.mockResolvedValue({
      id: "comp-1",
      contenidoId: "cont-1",
      usuarioOrigenId: userA,
      usuarioDestinoId: userB,
      estado: "rechazada",
      fechaEnvio: new Date(),
    } as never);
    mockComparticionRepo.findByIdConDetalles.mockResolvedValue({
      id: "comp-1",
      contenidoId: "cont-1",
      usuarioOrigenId: userA,
      usuarioDestinoId: userB,
      estado: "rechazada",
      fechaEnvio: new Date(),
      contenido: { id: "cont-1", titulo: "Matrix", imagenUrl: null, tipo: "pelicula", fuenteExterna: "tmdb", idExterno: "603" },
      usuarioOrigen: { id: userA, nombre: "Alice" },
      usuarioDestino: { id: userB, nombre: "Bob" },
    } as never);
    const req = reqConAuth("http://localhost:3000/api/comparticiones/comp-1", tokenB, {
      method: "PATCH",
      body: JSON.stringify({ accion: "rechazar" }),
    });
    const res = await PATCHComparticion(req, { params: Promise.resolve({ id: "comp-1" }) });
    expect(res.status).toBe(200);
    expect(mockUsuarioContenidoRepo.create).not.toHaveBeenCalled();
    expect(mockComparticionRepo.updateEstado).toHaveBeenCalledWith("comp-1", "rechazada");
  });

  it("403 si no es destinatario", async () => {
    const req = reqConAuth("http://localhost:3000/api/comparticiones/comp-1", tokenA, {
      method: "PATCH",
      body: JSON.stringify({ accion: "aceptar" }),
    });
    const res = await PATCHComparticion(req, { params: Promise.resolve({ id: "comp-1" }) });
    expect(res.status).toBe(403);
  });

  it("404 si no existe", async () => {
    mockComparticionRepo.findById.mockResolvedValue(null);
    const req = reqConAuth("http://localhost:3000/api/comparticiones/comp-1", tokenB, {
      method: "PATCH",
      body: JSON.stringify({ accion: "aceptar" }),
    });
    const res = await PATCHComparticion(req, { params: Promise.resolve({ id: "comp-1" }) });
    expect(res.status).toBe(404);
  });

  it("409 si ya no está pendiente", async () => {
    mockComparticionRepo.findById.mockResolvedValue({
      id: "comp-1",
      contenidoId: "cont-1",
      usuarioOrigenId: userA,
      usuarioDestinoId: userB,
      estado: "aceptada",
      fechaEnvio: new Date(),
    } as never);
    const req = reqConAuth("http://localhost:3000/api/comparticiones/comp-1", tokenB, {
      method: "PATCH",
      body: JSON.stringify({ accion: "aceptar" }),
    });
    const res = await PATCHComparticion(req, { params: Promise.resolve({ id: "comp-1" }) });
    expect(res.status).toBe(409);
  });

  it("400 si accion inválida", async () => {
    const req = reqConAuth("http://localhost:3000/api/comparticiones/comp-1", tokenB, {
      method: "PATCH",
      body: JSON.stringify({ accion: "otro" }),
    });
    const res = await PATCHComparticion(req, { params: Promise.resolve({ id: "comp-1" }) });
    expect(res.status).toBe(400);
  });

  it("401 sin token", async () => {
    const req = new NextRequest("http://localhost:3000/api/comparticiones/comp-1", {
      method: "PATCH",
      body: JSON.stringify({ accion: "aceptar" }),
    });
    const res = await PATCHComparticion(req, { params: Promise.resolve({ id: "comp-1" }) });
    expect(res.status).toBe(401);
  });
});
