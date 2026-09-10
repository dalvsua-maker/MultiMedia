import { describe, it, expect, vi, beforeEach } from "vitest";
import { BuscarContenidoUseCase } from "@/application/use-cases/BuscarContenido";
import type { IExternalSearchService } from "@/domain/services/IExternalSearchService";
import type { ResultadoBusqueda } from "@/application/dtos/BusquedaDto";
import { ExternalServiceError } from "@/application/errors/AppError";

function makeFakeService(
  results: ResultadoBusqueda[] = []
): IExternalSearchService & { search: ReturnType<typeof vi.fn> } {
  return {
    search: vi.fn(async () => results),
  };
}

const samplePelicula: ResultadoBusqueda = {
  fuenteExterna: "tmdb",
  idExterno: "123",
  tipo: "pelicula",
  titulo: "Matrix",
  imagenUrl: "https://example.com/poster.jpg",
  metadatos: { fecha: "1999-03-31" },
};

describe("BuscarContenidoUseCase (aplicación)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falla 400 si tipo falta o es inválido", async () => {
    const svc = makeFakeService();
    const uc = new BuscarContenidoUseCase(svc);
    await expect(uc.execute("", "matrix")).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(uc.execute("libro", "matrix")).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(uc.execute("Pelicula", "matrix")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(svc.search).not.toHaveBeenCalled();
  });

  it("falla 400 si q falta o <2 chars", async () => {
    const svc = makeFakeService();
    const uc = new BuscarContenidoUseCase(svc);
    await expect(uc.execute("pelicula", "")).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(uc.execute("pelicula", " ")).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(uc.execute("pelicula", "a")).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(uc.execute("pelicula", "  a  ")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(svc.search).not.toHaveBeenCalled();
  });

  it("valida q trim", async () => {
    const svc = makeFakeService([samplePelicula]);
    const uc = new BuscarContenidoUseCase(svc);
    const res = await uc.execute("pelicula", "  matrix  ");
    expect(svc.search).toHaveBeenCalledWith("pelicula", "matrix");
    expect(res.total).toBe(1);
  });

  it("delega al servicio externo con tipo/q correctos", async () => {
    const svc = makeFakeService([samplePelicula]);
    const uc = new BuscarContenidoUseCase(svc);
    await uc.execute("pelicula", "matrix");
    expect(svc.search).toHaveBeenCalledWith("pelicula", "matrix");
  });

  it("mapea fuente correctamente por tipo", async () => {
    const svc = makeFakeService([samplePelicula]);
    const uc = new BuscarContenidoUseCase(svc);

    const pelicula = await uc.execute("pelicula", "matrix");
    expect(pelicula.fuente).toBe("tmdb");
    const serie = await uc.execute("serie", "breaking");
    expect(serie.fuente).toBe("tmdb");
    const juego = await uc.execute("videojuego", "zelda");
    expect(juego.fuente).toBe("igdb");
    const musica = await uc.execute("musica", "beatles");
    expect(musica.fuente).toBe("spotify");
  });

  it("limita a 10 resultados aunque el servicio devuelva más", async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...samplePelicula,
      idExterno: String(i),
    }));
    const svc = makeFakeService(many);
    const uc = new BuscarContenidoUseCase(svc);
    const res = await uc.execute("pelicula", "matrix");
    expect(res.resultados).toHaveLength(10);
    expect(res.total).toBe(10);
  });

  it("envuelve respuesta {resultados,total,fuente}", async () => {
    const svc = makeFakeService([samplePelicula]);
    const uc = new BuscarContenidoUseCase(svc);
    const res = await uc.execute("pelicula", "matrix");
    expect(res).toEqual({
      resultados: [samplePelicula],
      total: 1,
      fuente: "tmdb",
    });
  });

  it("propaga ExternalServiceError (502) del adaptador", async () => {
    const svc: IExternalSearchService = {
      search: vi.fn(async () => {
        throw new ExternalServiceError("TMDB caído");
      }),
    };
    const uc = new BuscarContenidoUseCase(svc);
    await expect(uc.execute("pelicula", "matrix")).rejects.toMatchObject({
      statusCode: 502,
      code: "EXTERNAL_SERVICE_ERROR",
    });
  });
});
