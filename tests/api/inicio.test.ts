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

const mockRecoService = vi.hoisted(() => ({
  recomendar: vi.fn(),
  recomendarAgrupado: vi.fn(),
}));

vi.mock("@/infrastructure/repositories/PrismaUsuarioContenidoRepository", () => ({
  PrismaUsuarioContenidoRepository: vi.fn(function () {
    return mockUsuarioRepo;
  }),
}));

vi.mock("@/infrastructure/services/RecomendacionServiceV1", () => ({
  RecomendacionServiceV1: vi.fn(function () {
    return mockRecoService;
  }),
}));

vi.mock("@/infrastructure/services/RecomendacionServiceV2", () => ({
  RecomendacionServiceV2: vi.fn(function () {
    return mockRecoService;
  }),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {},
  default: {},
}));

import { GET as GETInicio } from "@/app/api/inicio/route";

const JWT_SECRET = "test-secret-inicio";
const userId = "user-1";
const token = jwt.sign({ sub: userId, email: "test@example.com" }, JWT_SECRET, {
  expiresIn: "1h",
});

function reqConAuth(url: string): NextRequest {
  const headers = new Headers();
  headers.set("authorization", `Bearer ${token}`);
  return new NextRequest(url, { headers });
}

describe("GET /api/inicio (UC6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
    mockUsuarioRepo.findAllByUsuarioId.mockResolvedValue([
      {
        contenido: {
          id: "c1",
          tipo: "pelicula",
          titulo: "Matrix",
          imagenUrl: null,
          fuenteExterna: "tmdb",
          idExterno: "603",
          fechaAnadido: new Date("2024-01-01"),
          detalle: { _tipo: "pelicula", anio: 1999 } as never,
        },
        estado: "en_proceso",
        fechaActualizacion: new Date("2024-01-02T00:00:00.000Z"),
      },
      {
        contenido: {
          id: "c2",
          tipo: "serie",
          titulo: "Breaking",
          imagenUrl: null,
          fuenteExterna: "tmdb",
          idExterno: "1396",
          fechaAnadido: new Date("2024-01-01"),
          detalle: null,
        },
        estado: "pendiente",
        fechaActualizacion: new Date("2024-01-01T00:00:00.000Z"),
      },
    ]);
    const recoItem = {
      id: "r1",
      tipo: "pelicula",
      titulo: "PeliReco",
      imagenUrl: null,
      fuenteExterna: "tmdb",
      idExterno: "999",
      fechaAnadido: new Date("2024-01-03"),
      detalle: null,
      yaAnadido: false,
    };
    mockRecoService.recomendar.mockResolvedValue([recoItem]);
    mockRecoService.recomendarAgrupado.mockResolvedValue({
      pelicula: [recoItem],
      serie: [],
      videojuego: [],
      musica: [],
    });
  });

  it("200 con enProceso y recomendaciones", async () => {
    const req = reqConAuth("http://localhost:3000/api/inicio");
    const res = await GETInicio(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      enProceso: { contenido: { id: string }; estado: string }[];
      recomendaciones: { id: string }[];
    };
    expect(body.enProceso).toHaveLength(1);
    expect(body.enProceso[0].contenido.id).toBe("c1");
    expect(body.enProceso[0].estado).toBe("en_proceso");
    expect(body.recomendaciones).toHaveLength(1);
    expect(body.recomendaciones[0].id).toBe("r1");
  });

  it("enProceso incluye detalle completo", async () => {
    const req = reqConAuth("http://localhost:3000/api/inicio");
    const res = await GETInicio(req);
    const body = (await res.json()) as { enProceso: { contenido: { detalle: unknown } }[] };
    expect(body.enProceso[0].contenido.detalle).toEqual(
      expect.objectContaining({ _tipo: "pelicula" })
    );
  });

  it("401 sin token", async () => {
    const req = new NextRequest("http://localhost:3000/api/inicio");
    const res = await GETInicio(req);
    expect(res.status).toBe(401);
  });

  it("401 con token inválido", async () => {
    const req = new NextRequest("http://localhost:3000/api/inicio", {
      headers: { authorization: "Bearer invalid" },
    });
    const res = await GETInicio(req);
    expect(res.status).toBe(401);
  });

  it("enProceso vacío si no hay en_proceso", async () => {
    mockUsuarioRepo.findAllByUsuarioId.mockResolvedValue([
      {
        contenido: {
          id: "c2",
          tipo: "serie",
          titulo: "Breaking",
          imagenUrl: null,
          fuenteExterna: "tmdb",
          idExterno: "1396",
          fechaAnadido: new Date("2024-01-01"),
          detalle: null,
        },
        estado: "pendiente",
        fechaActualizacion: new Date(),
      },
    ]);
    const req = reqConAuth("http://localhost:3000/api/inicio");
    const res = await GETInicio(req);
    const body = (await res.json()) as { enProceso: unknown[] };
    expect(body.enProceso).toEqual([]);
  });
});
