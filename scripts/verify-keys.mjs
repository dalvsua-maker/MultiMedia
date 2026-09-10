#!/usr/bin/env node
// Verifica que las 5 keys de UC1 funcionan contra las APIs reales
// Uso: node --env-file=.env scripts/verify-keys.mjs

const q = "matrix";
console.log("Verificando UC1 — APIs reales con q='matrix' (pelicula), 'zelda' (videojuego), 'beatles' (musica)\n");

async function testTmdb() {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY falta");
  console.log("→ TMDB (pelicula) ...");
  const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&language=es-ES&page=1`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} ${await res.text()}`);
  const data = await res.json();
  console.log(`  OK: ${data.results?.length ?? 0} resultados, primero: ${data.results?.[0]?.title ?? data.results?.[0]?.name ?? "n/a"}`);
  // Serie
  const res2 = await fetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent("breaking")}&language=es-ES&page=1`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res2.ok) throw new Error(`TMDB serie ${res2.status}`);
  const data2 = await res2.json();
  console.log(`  OK serie: ${data2.results?.length ?? 0} resultados, primero: ${data2.results?.[0]?.name ?? "n/a"}`);
}

async function testIgdb() {
  const id = process.env.IGDB_CLIENT_ID;
  const secret = process.env.IGDB_CLIENT_SECRET;
  if (!id || !secret) throw new Error("IGDB creds faltan");
  console.log("→ IGDB (videojuego) ...");
  const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`, {
    method: "POST",
    signal: AbortSignal.timeout(5000),
  });
  if (!tokenRes.ok) throw new Error(`Twitch ${tokenRes.status} ${await tokenRes.text()}`);
  const tokenData = await tokenRes.json();
  console.log(`  Token OK, expires_in ${tokenData.expires_in}`);
  const gamesRes = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: { "Client-ID": id, Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
    body: `fields name,cover.url,first_release_date,platforms.name; search "zelda"; limit 3;`,
    signal: AbortSignal.timeout(5000),
  });
  if (!gamesRes.ok) throw new Error(`IGDB ${gamesRes.status} ${await gamesRes.text()}`);
  const games = await gamesRes.json();
  console.log(`  OK: ${games.length} juegos, primero: ${games[0]?.name ?? "n/a"}`);
}

async function testSpotify() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Spotify creds faltan");
  console.log("→ Spotify (musica) ...");
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(5000),
  });
  if (!tokenRes.ok) throw new Error(`Spotify token ${tokenRes.status} ${await tokenRes.text()}`);
  const tokenData = await tokenRes.json();
  console.log(`  Token OK, expires_in ${tokenData.expires_in}`);
  const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent("beatles")}&type=track&limit=3`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!searchRes.ok) throw new Error(`Spotify search ${searchRes.status} ${await searchRes.text()}`);
  const data = await searchRes.json();
  console.log(`  OK: ${data.tracks?.items?.length ?? 0} tracks, primero: ${data.tracks?.items?.[0]?.name ?? "n/a"}`);
}

try {
  await testTmdb();
  await testIgdb();
  await testSpotify();
  console.log("\n✓ Todas las APIs de UC1 responden correctamente");
} catch (e) {
  console.error("\n✗ Fallo UC1:", e.message);
  process.exit(1);
}
