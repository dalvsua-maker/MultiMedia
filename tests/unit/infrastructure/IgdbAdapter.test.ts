import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { IgdbAdapter } from "@/infrastructure/services/IgdbAdapter";
import { ValidationError } from "@/application/errors/AppError";

describe("IgdbAdapter (infra, con cache Twitch)", () => {
  const origId = process.env.IGDB_CLIENT_ID;
  const origSecret = process.env.IGDB_CLIENT_SECRET;

  beforeEach(() => {
    vi.restoreAllMocks();
    IgdbAdapter._resetCache();
    process.env.IGDB_CLIENT_ID = "test-igdb-id";
    process.env.IGDB_CLIENT_SECRET = "test-igdb-secret";
  });

  afterEach(() => {
    if (origId === undefined) delete process.env.IGDB_CLIENT_ID;
    else process.env.IGDB_CLIENT_ID = origId;
    if (origSecret === undefined) delete process.env.IGDB_CLIENT_SECRET;
    else process.env.IGDB_CLIENT_SECRET = origSecret;
    IgdbAdapter._resetCache();
    vi.restoreAllMocks();
  });

  it("falla si faltan credenciales", async () => {
    delete process.env.IGDB_CLIENT_ID;
    const adapter = new IgdbAdapter();
    await expect(adapter.search("videojuego", "zelda")).rejects.toBeInstanceOf(
      ValidationError
    );
    process.env.IGDB_CLIENT_ID = "id";
    delete process.env.IGDB_CLIENT_SECRET;
    await expect(adapter.search("videojuego", "zelda")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("rechaza tipo no soportado", async () => {
    const adapter = new IgdbAdapter();
    // @ts-expect-error pelicula no soportado solo videojuego
    await expect(adapter.search("pelicula", "matrix")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("obtiene token Twitch y cachea, mapea juegos, imagenUrl y metadatos", async () => {
    const fetchMock = vi.spyOn(global, "fetch");

    // 1ª llamada: token Twitch
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ access_token: "twitch-token-1", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    // 2ª llamada: búsqueda juegos
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: 1,
            name: "Zelda",
            cover: { url: "//images.igdb.com/cover.jpg" },
            first_release_date: 1620000000,
            platforms: [{ name: "Switch" }, { name: "Wii" }],
          },
          {
            id: 2,
            name: "Mario",
            cover: undefined,
            first_release_date: undefined,
            platforms: undefined,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const adapter = new IgdbAdapter();
    const res1 = await adapter.search("videojuego", "zelda");

    expect(res1).toHaveLength(2);
    expect(res1[0].titulo).toBe("Zelda");
    expect(res1[0].fuenteExterna).toBe("igdb");
    expect(res1[0].tipo).toBe("videojuego");
    expect(res1[0].imagenUrl).toBe("https://images.igdb.com/cover.jpg");
    expect(res1[0].metadatos.plataformas).toEqual(["Switch", "Wii"]);
    expect(res1[0].metadatos.fecha).toBeDefined();
    expect(res1[1].imagenUrl).toBeNull();

    // 2ª búsqueda debe reusar token (solo 1 fetch más, no 2)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 3, name: "Zelda 2" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const res2 = await adapter.search("videojuego", "zelda2");
    expect(fetchMock).toHaveBeenCalledTimes(3); // token + search1 + search2 (token cacheado)
    expect(res2).toHaveLength(1);
  });

  it("lanza 502 si Twitch !ok", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("error", { status: 403 })
    );
    const adapter = new IgdbAdapter();
    const err = await adapter.search("videojuego", "zelda").catch((e) => e);
    expect(err.statusCode).toBe(502);
  });

  it("lanza 502 si IGDB !ok", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(new Response("error", { status: 500 }));
    const adapter = new IgdbAdapter();
    const err = await adapter.search("videojuego", "zelda").catch((e) => e);
    expect(err.statusCode).toBe(502);
  });
});
