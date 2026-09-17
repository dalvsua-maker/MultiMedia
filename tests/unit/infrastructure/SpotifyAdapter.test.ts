import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpotifyAdapter } from "@/infrastructure/services/SpotifyAdapter";
import { ValidationError } from "@/application/errors/AppError";

describe("SpotifyAdapter (infra, con cache)", () => {
  const origId = process.env.SPOTIFY_CLIENT_ID;
  const origSecret = process.env.SPOTIFY_CLIENT_SECRET;

  beforeEach(() => {
    vi.restoreAllMocks();
    SpotifyAdapter._resetCache();
    process.env.SPOTIFY_CLIENT_ID = "test-spot-id";
    process.env.SPOTIFY_CLIENT_SECRET = "test-spot-secret";
  });

  afterEach(() => {
    if (origId === undefined) delete process.env.SPOTIFY_CLIENT_ID;
    else process.env.SPOTIFY_CLIENT_ID = origId;
    if (origSecret === undefined) delete process.env.SPOTIFY_CLIENT_SECRET;
    else process.env.SPOTIFY_CLIENT_SECRET = origSecret;
    SpotifyAdapter._resetCache();
    vi.restoreAllMocks();
  });

  it("falla si faltan credenciales", async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    const adapter = new SpotifyAdapter();
    await expect(adapter.search("musica", "beatles")).rejects.toBeInstanceOf(
      ValidationError
    );
    process.env.SPOTIFY_CLIENT_ID = "id";
    delete process.env.SPOTIFY_CLIENT_SECRET;
    await expect(adapter.search("musica", "beatles")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("rechaza tipo no soportado", async () => {
    const adapter = new SpotifyAdapter();
    // @ts-expect-error pelicula no soportado solo musica
    await expect(adapter.search("pelicula", "matrix")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("obtiene token y cachea, mapea tracks, imagenUrl y metadatos", async () => {
    const fetchMock = vi.spyOn(global, "fetch");

    // token
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: "spot-token", expires_in: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    // search
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tracks: {
            items: [
              {
                id: "track1",
                name: "Song 1",
                album: { name: "Album 1", images: [{ url: "https://img/1.jpg" }] },
                artists: [{ name: "Artist A" }, { name: "Artist B" }],
                duration_ms: 210_000,
                popularity: 85,
              },
              {
                id: "track2",
                name: "Song 2",
                album: { name: "Album 2", images: [] },
                artists: [{ name: "Solo" }],
                duration_ms: 180_000,
                popularity: 70,
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    // enrich con popularity (GET /v1/tracks?ids=...)
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tracks: [
            {
              id: "track1",
              name: "Song 1",
              album: { name: "Album 1", images: [{ url: "https://img/1.jpg" }] },
              artists: [{ name: "Artist A" }, { name: "Artist B" }],
              duration_ms: 210_000,
              popularity: 85,
            },
            {
              id: "track2",
              name: "Song 2",
              album: { name: "Album 2", images: [] },
              artists: [{ name: "Solo" }],
              duration_ms: 180_000,
              popularity: 70,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const adapter = new SpotifyAdapter();
    const res1 = await adapter.search("musica", "beatles");

    expect(res1).toHaveLength(2);
    expect(res1[0].fuenteExterna).toBe("spotify");
    expect(res1[0].tipo).toBe("musica");
    expect(res1[0].titulo).toBe("Song 1");
    expect(res1[0].imagenUrl).toBe("https://img/1.jpg");
    expect(res1[0].metadatos.artista).toBe("Artist A, Artist B");
    expect(res1[0].metadatos.album).toBe("Album 1");
    expect(res1[0].metadatos.duracionSeg).toBe(210);
    expect(res1[1].imagenUrl).toBeNull();

    // segunda búsqueda debe reusar token
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tracks: { items: [{ id: "track3", name: "Song 3", album: { name: "A", images: [] }, artists: [{ name: "X" }], duration_ms: 200000, popularity: 60 }] },
        }),
        { status: 200 }
      )
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          tracks: [{ id: "track3", name: "Song 3", album: { name: "A", images: [] }, artists: [{ name: "X" }], duration_ms: 200000, popularity: 60 }],
        }),
        { status: 200 }
      )
    );
    const res2 = await adapter.search("musica", "beatles2");
    expect(fetchMock).toHaveBeenCalledTimes(5); // token + search1 + enrich1 + search2 + enrich2
    expect(res2).toHaveLength(1);
  });

  it("lanza 502 si Spotify OAuth !ok", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("error", { status: 401 }));
    const adapter = new SpotifyAdapter();
    const err = await adapter.search("musica", "beatles").catch((e) => e);
    expect(err.statusCode).toBe(502);
  });

  it("lanza 502 si search !ok", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "tok", expires_in: 3600 }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response("error", { status: 500 }));
    const adapter = new SpotifyAdapter();
    const err = await adapter.search("musica", "beatles").catch((e) => e);
    expect(err.statusCode).toBe(502);
  });
});
