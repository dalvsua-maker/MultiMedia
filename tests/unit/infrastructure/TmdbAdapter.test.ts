import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TmdbAdapter } from "@/infrastructure/services/TmdbAdapter";
import { ValidationError } from "@/application/errors/AppError";

describe("TmdbAdapter (infra)", () => {
  const originalEnv = process.env.TMDB_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.TMDB_API_KEY = "test-tmdb-bearer-token";
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = originalEnv;
    vi.restoreAllMocks();
  });

  it("falla ValidationError si falta TMDB_API_KEY", async () => {
    delete process.env.TMDB_API_KEY;
    const adapter = new TmdbAdapter();
    await expect(adapter.search("pelicula", "matrix")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("rechaza tipo no soportado", async () => {
    const adapter = new TmdbAdapter();
    // @ts-expect-error test runtime
    await expect(adapter.search("videojuego", "zelda")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("mapea peliculas y limita a 10, imagenUrl null sin poster", async () => {
    const mockResults = Array.from({ length: 12 }, (_, i) => ({
      id: 100 + i,
      title: `Movie ${i}`,
      poster_path: i === 0 ? null : `/poster${i}.jpg`,
      release_date: "1999-03-31",
      overview: "desc",
    }));

    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: mockResults }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const adapter = new TmdbAdapter();
    const res = await adapter.search("pelicula", "matrix");

    expect(fetchMock).toHaveBeenCalledOnce();
    const url = (fetchMock.mock.calls[0][0] as string);
    expect(url).toContain("/search/movie");
    expect(url).toContain("query=matrix");

    expect(res).toHaveLength(10); // límite
    expect(res[0].idExterno).toBe("100");
    expect(res[0].imagenUrl).toBeNull(); // primer sin poster
    expect(res[1].imagenUrl).toBe("https://image.tmdb.org/t/p/w500/poster1.jpg");
    expect(res[0].fuenteExterna).toBe("tmdb");
    expect(res[0].tipo).toBe("pelicula");
  });

  it("mapea series (tv)", async () => {
    const mockResults = [
      {
        id: 200,
        name: "Breaking Bad",
        poster_path: "/bb.jpg",
        first_air_date: "2008-01-20",
        overview: "desc",
      },
    ];
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: mockResults }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const adapter = new TmdbAdapter();
    const res = await adapter.search("serie", "breaking");

    expect(res).toHaveLength(1);
    expect(res[0].titulo).toBe("Breaking Bad");
    expect(res[0].tipo).toBe("serie");
    expect(res[0].idExterno).toBe("200");
  });

  it("lanza ExternalServiceError si TMDB responde !ok", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 })
    );

    const adapter = new TmdbAdapter();
    const err = await adapter.search("pelicula", "matrix").catch((e) => e);
    expect(err.statusCode).toBe(502);
    expect(err.code).toBe("EXTERNAL_SERVICE_ERROR");
  });

  it("lanza ExternalServiceError en timeout/abort", async () => {
    vi.spyOn(global, "fetch").mockImplementation(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });

    const adapter = new TmdbAdapter();
    const err = await adapter.search("pelicula", "matrix").catch((e) => e);
    expect(err.statusCode).toBe(502);
  });
});
