import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

const mockUsuarioRepo = vi.hoisted(() => ({
  find: vi.fn(),
  exists: vi.fn(),
  create: vi.fn(),
  findAllByUsuarioId: vi.fn(),
  updateEstado: vi.fn(),
}));

vi.mock("@/infrastructure/repositories/PrismaUsuarioContenidoRepository", () => ({
  PrismaUsuarioContenidoRepository: vi.fn(function () {
    return mockUsuarioRepo;
  }),
}));
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {},
  default: {},
}));

import { GET as GETUsuarioContenido } from "@/app/api/usuario-contenido/route";
import { PATCH as PATCHUsuarioContenido } from "@/app/api/usuario-contenido/[cid]/route";

const JWT_SECRET = "test-secret-uc4";
const userId = "user-1";
const token = jwt.sign({ sub: userId, email: "test@example.com" }, JWT_SECRET, {
  expiresIn: "1h",
});

function reqConAuth(url: string, init: RequestInit = {}): NextRequest {
  const headers = new Headers(init.headers as HeadersInit);
  headers.set("authorization", `Bearer ${token}`);
  return new NextRequest(url, { ...init, headers } as unknown as RequestInit);
}

describe("GET /api/usuario-contenido (UC4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
    mockUsuarioRepo.findAllByUsuarioId.mockResolvedValue([
      {
        contenido: {
          id: "cont-1",
          tipo: "pelicula",
          titulo: "Matrix",
          imagenUrl: null,
          fuenteExterna: "tmdb",
          idExterno: "603",
          fechaAnadido: new Date("2024-01-01"),
          detalle: null,
        },
        estado: "pendiente",
        fechaActualizacion: new Date("2024-01-01T00:00:00.000Z"),
      },
    ]);
  });

  it("200 lista contenidos del usuario", async () => {
    const req = reqConAuth("http://localhost:3000/api/usuario-contenido");
    const res = await GETUsuarioContenido(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number; contenidos: unknown[] };
    expect(body.total).toBe(1);
    expect(body.contenidos).toHaveLength(1);
  });

  it("401 sin token", async () => {
    const req = new NextRequest("http://localhost:3000/api/usuario-contenido");
    const res = await GETUsuarioContenido(req);
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/usuario-contenido/:cid (UC4 transiciones)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
    mockUsuarioRepo.find.mockResolvedValue({
      estado: "pendiente",
      fechaActualizacion: new Date(),
    } as never);
  });

  it("200 pendiente -> en_proceso", async () => {
    const req = reqConAuth("http://localhost:3000/api/usuario-contenido/cont-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "en_proceso" }),
    });
    const res = await PATCHUsuarioContenido(req, {
      params: Promise.resolve({ cid: "cont-1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { estado: string };
    expect(body.estado).toBe("en_proceso");
    expect(mockUsuarioRepo.updateEstado).toHaveBeenCalledWith("user-1", "cont-1", "en_proceso");
  });

  it("200 idempotente mismo estado", async () => {
    const req = reqConAuth("http://localhost:3000/api/usuario-contenido/cont-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "pendiente" }),
    });
    const res = await PATCHUsuarioContenido(req, {
      params: Promise.resolve({ cid: "cont-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockUsuarioRepo.updateEstado).not.toHaveBeenCalled();
  });

  it("200 pendiente -> visto ahora permitido (retroceso libre)", async () => {
    const req = reqConAuth("http://localhost:3000/api/usuario-contenido/cont-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "visto" }),
    });
    const res = await PATCHUsuarioContenido(req, {
      params: Promise.resolve({ cid: "cont-1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { estado: string };
    expect(body.estado).toBe("visto");
    expect(mockUsuarioRepo.updateEstado).toHaveBeenCalledWith("user-1", "cont-1", "visto");
  });

  it("404 si contenido no está en cuenta", async () => {
    mockUsuarioRepo.find.mockResolvedValue(null);
    const req = reqConAuth("http://localhost:3000/api/usuario-contenido/cont-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "en_proceso" }),
    });
    const res = await PATCHUsuarioContenido(req, {
      params: Promise.resolve({ cid: "cont-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("400 si estado inválido", async () => {
    const req = reqConAuth("http://localhost:3000/api/usuario-contenido/cont-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "otro" }),
    });
    const res = await PATCHUsuarioContenido(req, {
      params: Promise.resolve({ cid: "cont-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("401 sin token", async () => {
    mockUsuarioRepo.find.mockResolvedValue(null);
    const req = new NextRequest("http://localhost:3000/api/usuario-contenido/cont-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "en_proceso" }),
    });
    const res = await PATCHUsuarioContenido(req, {
      params: Promise.resolve({ cid: "cont-1" }),
    });
    expect(res.status).toBe(401);
  });
});
