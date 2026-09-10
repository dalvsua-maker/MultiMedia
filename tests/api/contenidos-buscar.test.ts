import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";
import { ExternalServiceError } from "@/application/errors/AppError";

const mockSearch = vi.hoisted(() => vi.fn());

vi.mock("@/infrastructure/services/ExternalSearchService", () => ({
  ExternalSearchService: vi.fn(function () {
    return { search: mockSearch };
  }),
}));

import { GET as GETBuscar } from "@/app/api/contenidos/buscar/route";

const JWT_SECRET = "test-secret-buscar";
const userId = "user-123";
const token = jwt.sign({ sub: userId, email: "test@example.com" }, JWT_SECRET, {
  expiresIn: "1h",
});

function reqConAuth(url: string, tokenOverride?: string): NextRequest {
  const headers = new Headers();
  headers.set("authorization", `Bearer ${tokenOverride ?? token}`);
  return new NextRequest(url, { headers });
}

describe("GET /api/contenidos/buscar (UC1, auth requerida)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = JWT_SECRET;
    mockSearch.mockResolvedValue([
      {
        fuenteExterna: "tmdb",
        idExterno: "123",
        tipo: "pelicula",
        titulo: "Matrix",
        imagenUrl: "https://img/1.jpg",
        metadatos: { fecha: "1999-03-31" },
      },
    ]);
  });

  it("200 envuelto {resultados,total,fuente} con pelicula", async () => {
    const req = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?tipo=pelicula&q=matrix"
    );
    const res = await GETBuscar(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      resultados: unknown[];
      total: number;
      fuente: string;
    };
    expect(body.resultados).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.fuente).toBe("tmdb");
    expect(mockSearch).toHaveBeenCalledWith("pelicula", "matrix");
  });

  it("200 para serie, videojuego (igdb) y musica (spotify) con fuente correcta", async () => {
    mockSearch.mockResolvedValue([]);
    const reqSerie = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?tipo=serie&q=breaking"
    );
    const resSerie = await GETBuscar(reqSerie);
    expect(resSerie.status).toBe(200);
    const bodySerie = (await resSerie.json()) as { fuente: string };
    expect(bodySerie.fuente).toBe("tmdb");

    const reqJuego = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?tipo=videojuego&q=zelda"
    );
    const resJuego = await GETBuscar(reqJuego);
    expect((await resJuego.json() as { fuente: string }).fuente).toBe("igdb");

    const reqMusica = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?tipo=musica&q=beatles"
    );
    const resMusica = await GETBuscar(reqMusica);
    expect((await resMusica.json() as { fuente: string }).fuente).toBe("spotify");
  });

  it("401 sin token", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/contenidos/buscar?tipo=pelicula&q=matrix"
    );
    const res = await GETBuscar(req);
    expect(res.status).toBe(401);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("401 con token inválido", async () => {
    const req = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?tipo=pelicula&q=matrix",
      "invalid"
    );
    const res = await GETBuscar(req);
    expect(res.status).toBe(401);
  });

  it("400 sin tipo o tipo inválido", async () => {
    const reqSinTipo = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?q=matrix"
    );
    expect((await GETBuscar(reqSinTipo)).status).toBe(400);

    const reqInvalido = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?tipo=libro&q=matrix"
    );
    expect((await GETBuscar(reqInvalido)).status).toBe(400);
  });

  it("400 sin q o q <2 chars", async () => {
    const reqSinQ = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?tipo=pelicula&q="
    );
    expect((await GETBuscar(reqSinQ)).status).toBe(400);

    const reqCorta = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?tipo=pelicula&q=a"
    );
    expect((await GETBuscar(reqCorta)).status).toBe(400);

    const reqEspacio = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?tipo=pelicula&q=%20%20a%20"
    );
    expect((await GETBuscar(reqEspacio)).status).toBe(400);
  });

  it("502 si adaptador externo falla", async () => {
    mockSearch.mockRejectedValue(new ExternalServiceError("TMDB caído"));
    const req = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?tipo=pelicula&q=matrix"
    );
    const res = await GETBuscar(req);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("EXTERNAL_SERVICE_ERROR");
  });

  it("trim de q antes de buscar", async () => {
    const req = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?tipo=pelicula&q=%20%20matrix%20%20"
    );
    await GETBuscar(req);
    expect(mockSearch).toHaveBeenCalledWith("pelicula", "matrix");
  });

  it("propaga total correctamente con múltiples resultados", async () => {
    mockSearch.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        fuenteExterna: "tmdb" as const,
        idExterno: String(i),
        tipo: "pelicula" as const,
        titulo: `M ${i}`,
        imagenUrl: null,
        metadatos: {},
      }))
    );
    const req = reqConAuth(
      "http://localhost:3000/api/contenidos/buscar?tipo=pelicula&q=matrix"
    );
    const res = await GETBuscar(req);
    const body = (await res.json()) as { total: number; resultados: unknown[] };
    expect(body.total).toBe(5);
    expect(body.resultados).toHaveLength(5);
  });
});

// Test opcional real (solo si hay key, no toca DB)
describe("GET /api/contenidos/buscar — real (requiere TMDB_API_KEY)", () => {
  const hasTmdb = !!process.env.TMDB_API_KEY;

  it.skipIf(!hasTmdb)("mock real deshabilitado sin TMDB_API_KEY", async () => {
    // Este bloque solo corre si TMDB_API_KEY está en .env real (no mockeado)
    // Usa fetch real — no se mockea ExternalSearchService aquí
    vi.restoreAllMocks();
    const { ExternalSearchService } = await import(
      "@/infrastructure/services/ExternalSearchService"
    );
    const svc = new ExternalSearchService();
    const res = await svc.search("pelicula", "matrix");
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].fuenteExterna).toBe("tmdb");
  });
});
