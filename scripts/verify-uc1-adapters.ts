import "dotenv/config";
import { TmdbAdapter } from "../src/infrastructure/services/TmdbAdapter";
import { IgdbAdapter } from "../src/infrastructure/services/IgdbAdapter";
import { SpotifyAdapter } from "../src/infrastructure/services/SpotifyAdapter";
import { ExternalSearchService } from "../src/infrastructure/services/ExternalSearchService";
import { BuscarContenidoUseCase } from "../src/application/use-cases/BuscarContenido";

async function main() {
  console.log("Verificando adapters UC1 con credenciales reales (.env)\n");

  const tmdb = new TmdbAdapter();
  console.log("→ TmdbAdapter pelicula 'matrix'");
  const pelis = await tmdb.search("pelicula", "matrix");
  console.log(`  OK: ${pelis.length} (limite 10), primero: ${pelis[0]?.titulo} [${pelis[0]?.fuenteExterna}]`);

  console.log("→ TmdbAdapter serie 'breaking'");
  const series = await tmdb.search("serie", "breaking");
  console.log(`  OK: ${series.length}, primero: ${series[0]?.titulo}`);

  const igdb = new IgdbAdapter();
  console.log("→ IgdbAdapter videojuego 'zelda'");
  const juegos = await igdb.search("videojuego", "zelda");
  console.log(`  OK: ${juegos.length}, primero: ${juegos[0]?.titulo} [${juegos[0]?.fuenteExterna}]`);

  const spotify = new SpotifyAdapter();
  console.log("→ SpotifyAdapter musica 'beatles'");
  const musica = await spotify.search("musica", "beatles");
  console.log(`  OK: ${musica.length}, primero: ${musica[0]?.titulo} [${musica[0]?.fuenteExterna}]`);

  console.log("→ ExternalSearchService (composite) + BuscarContenidoUseCase");
  const service = new ExternalSearchService();
  const useCase = new BuscarContenidoUseCase(service);
  const res = await useCase.execute("pelicula", "matrix");
  console.log(`  OK useCase: total=${res.total}, fuente=${res.fuente}, primero=${res.resultados[0]?.titulo}`);
  if (res.total > 10) throw new Error("limite 10 violado");
  if (res.fuente !== "tmdb") throw new Error("fuente incorrecta");

  // Validaciones
  console.log("→ Validaciones q<2 y tipo inválido");
  try {
    await useCase.execute("pelicula", "a");
    throw new Error("debería fallar q<2");
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode !== 400) throw new Error("q<2 no dio 400");
    console.log("  OK q<2 → 400");
  }
  try {
    await useCase.execute("libro", "matrix");
    throw new Error("debería fallar tipo inválido");
  } catch (e: unknown) {
    const err = e as { statusCode?: number };
    if (err.statusCode !== 400) throw new Error("tipo inválido no dio 400");
    console.log("  OK tipo inválido → 400");
  }

  console.log("\n✓ Adapters y caso de uso UC1 OK con credenciales reales");
}

main().catch((e) => {
  console.error("\n✗ Fallo adapters:", e);
  process.exit(1);
});
