import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

// Mock del repositorio para endpoints (no toca DB)
const mockRepo = vi.hoisted(() => ({
  create: vi.fn(),
  findByUsuarioId: vi.fn(),
  findById: vi.fn(),
  findByIdWithContenidos: vi.fn(),
  addContenido: vi.fn(),
  removeContenido: vi.fn(),
  existsContenidoInLista: vi.fn(),
  contenidoExists: vi.fn(),
}));

vi.mock("@/infrastructure/repositories/PrismaListaRepository", () => ({
  PrismaListaRepository: vi.fn(function () {
    return mockRepo;
  }),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {},
  default: {},
}));

import { GET as GETListas, POST as POSTListas } from "@/app/api/listas/route";
import { GET as GETLista } from "@/app/api/listas/[id]/route";
import { POST as POSTContenido } from "@/app/api/listas/[id]/contenidos/route";
import { DELETE as DELETEContenido } from "@/app/api/listas/[id]/contenidos/[cid]/route";

const JWT_SECRET = "test-secret-listas";
const userId = "user-123";
const token = jwt.sign({ sub: userId, email: "test@example.com" }, JWT_SECRET, {
  expiresIn: "1h",
});

function reqWithAuth(url: string, init: RequestInit = {}): NextRequest {
  const headers = new Headers(init.headers as HeadersInit);
  headers.set("authorization", `Bearer ${token}`);
  // Next's RequestInit is stricter than DOM (signal: undefined vs null) — cast via any
  return new NextRequest(url, { ...init, headers } as unknown as RequestInit);
}

describe("Endpoints /api/listas (auth + UC3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
    mockRepo.create.mockResolvedValue({
      id: "lista-1",
      usuarioId: userId,
      nombre: "Favoritas",
      descripcion: null,
      fechaCreacion: new Date("2024-01-01T00:00:00.000Z"),
    });
    mockRepo.findByUsuarioId.mockResolvedValue([
      {
        id: "lista-1",
        usuarioId: userId,
        nombre: "Favoritas",
        descripcion: null,
        fechaCreacion: new Date("2024-01-01T00:00:00.000Z"),
      },
    ]);
    mockRepo.findById.mockResolvedValue({
      id: "lista-1",
      usuarioId: userId,
      nombre: "Favoritas",
      descripcion: null,
      fechaCreacion: new Date(),
    });
    mockRepo.findByIdWithContenidos.mockResolvedValue({
      id: "lista-1",
      usuarioId: userId,
      nombre: "Favoritas",
      descripcion: null,
      fechaCreacion: new Date("2024-01-01T00:00:00.000Z"),
      contenidos: [],
    });
    mockRepo.contenidoExists.mockResolvedValue(true);
    mockRepo.existsContenidoInLista.mockResolvedValue(false);
  });

  it("GET /api/listas → 200 con listas del usuario", async () => {
    const req = reqWithAuth("http://localhost:3000/api/listas");
    const res = await GETListas(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it("GET /api/listas → 401 sin token", async () => {
    const req = new NextRequest("http://localhost:3000/api/listas");
    const res = await GETListas(req);
    expect(res.status).toBe(401);
  });

  it("POST /api/listas → 201 crea lista", async () => {
    const req = reqWithAuth("http://localhost:3000/api/listas", {
      method: "POST",
      body: JSON.stringify({ nombre: "Nueva", descripcion: "desc" }),
    });
    const res = await POSTListas(req);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { nombre: string };
    expect(body.nombre).toBe("Favoritas");
    expect(mockRepo.create).toHaveBeenCalledWith({
      usuarioId: userId,
      nombre: "Nueva",
      descripcion: "desc",
    });
  });

  it("POST /api/listas → 400 con nombre vacío", async () => {
    const req = reqWithAuth("http://localhost:3000/api/listas", {
      method: "POST",
      body: JSON.stringify({ nombre: "" }),
    });
    const res = await POSTListas(req);
    expect(res.status).toBe(400);
  });

  it("GET /api/listas/:id → 200 detalle", async () => {
    const req = reqWithAuth("http://localhost:3000/api/listas/lista-1");
    const res = await GETLista(req, { params: Promise.resolve({ id: "lista-1" }) });
    expect(res.status).toBe(200);
  });

  it("GET /api/listas/:id → 403 si no es propietario", async () => {
    mockRepo.findByIdWithContenidos.mockResolvedValue({
      id: "lista-1",
      usuarioId: "otro-user",
      nombre: "Otra",
      descripcion: null,
      fechaCreacion: new Date(),
      contenidos: [],
    });
    const req = reqWithAuth("http://localhost:3000/api/listas/lista-1");
    const res = await GETLista(req, { params: Promise.resolve({ id: "lista-1" }) });
    expect(res.status).toBe(403);
  });

  it("POST /api/listas/:id/contenidos → 201 añade contenido", async () => {
    const req = reqWithAuth("http://localhost:3000/api/listas/lista-1/contenidos", {
      method: "POST",
      body: JSON.stringify({ contenidoId: "cont-1" }),
    });
    const res = await POSTContenido(req, { params: Promise.resolve({ id: "lista-1" }) });
    expect(res.status).toBe(201);
    expect(mockRepo.addContenido).toHaveBeenCalledWith("lista-1", "cont-1");
  });

  it("POST /api/listas/:id/contenidos → 409 si ya existe", async () => {
    mockRepo.existsContenidoInLista.mockResolvedValue(true);
    const req = reqWithAuth("http://localhost:3000/api/listas/lista-1/contenidos", {
      method: "POST",
      body: JSON.stringify({ contenidoId: "cont-1" }),
    });
    const res = await POSTContenido(req, { params: Promise.resolve({ id: "lista-1" }) });
    expect(res.status).toBe(409);
  });

  it("DELETE /api/listas/:id/contenidos/:cid → 200 elimina", async () => {
    mockRepo.existsContenidoInLista.mockResolvedValue(true);
    const req = reqWithAuth("http://localhost:3000/api/listas/lista-1/contenidos/cont-1", {
      method: "DELETE",
    });
    const res = await DELETEContenido(req, {
      params: Promise.resolve({ id: "lista-1", cid: "cont-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockRepo.removeContenido).toHaveBeenCalledWith("lista-1", "cont-1");
  });

  it("DELETE → 404 si no está en la lista", async () => {
    mockRepo.existsContenidoInLista.mockResolvedValue(false);
    const req = reqWithAuth("http://localhost:3000/api/listas/lista-1/contenidos/cont-1", {
      method: "DELETE",
    });
    const res = await DELETEContenido(req, {
      params: Promise.resolve({ id: "lista-1", cid: "cont-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/listas/:id/contenidos → 401 con token inválido", async () => {
    const req = new NextRequest("http://localhost:3000/api/listas/lista-1/contenidos", {
      method: "POST",
      headers: { authorization: "Bearer invalid" },
      body: JSON.stringify({ contenidoId: "cont-1" }),
    });
    const res = await POSTContenido(req, { params: Promise.resolve({ id: "lista-1" }) });
    expect(res.status).toBe(401);
  });
});
