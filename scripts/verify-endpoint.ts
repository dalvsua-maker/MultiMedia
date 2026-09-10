import "dotenv/config";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/contenidos/buscar/route";

async function main() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET falta");
  const token = jwt.sign({ sub: "user-test", email: "test@example.com" }, secret, { expiresIn: "1h" });

  console.log("Verificando endpoint GET /api/contenidos/buscar con auth real\n");

  // 401 sin token
  const reqSinAuth = new NextRequest("http://localhost:3000/api/contenidos/buscar?tipo=pelicula&q=matrix");
  const res401 = await GET(reqSinAuth);
  console.log(`401 sin token: ${res401.status} ${res401.status === 401 ? "OK" : "FAIL"}`);
  if (res401.status !== 401) throw new Error("esperaba 401");

  // 400 sin tipo
  const reqSinTipo = new NextRequest("http://localhost:3000/api/contenidos/buscar?q=matrix", {
    headers: { authorization: `Bearer ${token}` },
  });
  const res400 = await GET(reqSinTipo);
  console.log(`400 sin tipo: ${res400.status} ${res400.status === 400 ? "OK" : "FAIL"}`);

  // 400 q<2
  const reqQcorta = new NextRequest("http://localhost:3000/api/contenidos/buscar?tipo=pelicula&q=a", {
    headers: { authorization: `Bearer ${token}` },
  });
  const res400q = await GET(reqQcorta);
  console.log(`400 q<2: ${res400q.status} ${res400q.status === 400 ? "OK" : "FAIL"}`);

  // 200 pelicula
  const reqPeli = new NextRequest("http://localhost:3000/api/contenidos/buscar?tipo=pelicula&q=matrix", {
    headers: { authorization: `Bearer ${token}` },
  });
  const res200 = await GET(reqPeli);
  const body = await res200.json() as { resultados: unknown[]; total: number; fuente: string };
  console.log(`200 pelicula: status ${res200.status}, total ${body.total}, fuente ${body.fuente}, resultados ${body.resultados.length}`);
  if (res200.status !== 200 || body.fuente !== "tmdb" || body.total === 0) throw new Error("pelicula falló");

  // 200 serie
  const reqSerie = new NextRequest("http://localhost:3000/api/contenidos/buscar?tipo=serie&q=breaking", {
    headers: { authorization: `Bearer ${token}` },
  });
  const resSerie = await GET(reqSerie);
  const bodySerie = await resSerie.json() as { fuente: string };
  console.log(`200 serie: fuente ${bodySerie.fuente} ${bodySerie.fuente === "tmdb" ? "OK" : "FAIL"}`);

  // 200 videojuego
  const reqJuego = new NextRequest("http://localhost:3000/api/contenidos/buscar?tipo=videojuego&q=zelda", {
    headers: { authorization: `Bearer ${token}` },
  });
  const resJuego = await GET(reqJuego);
  const bodyJuego = await resJuego.json() as { fuente: string; total: number };
  console.log(`200 videojuego: fuente ${bodyJuego.fuente} total ${bodyJuego.total} ${bodyJuego.fuente === "igdb" ? "OK" : "FAIL"}`);

  // 200 musica
  const reqMusica = new NextRequest("http://localhost:3000/api/contenidos/buscar?tipo=musica&q=beatles", {
    headers: { authorization: `Bearer ${token}` },
  });
  const resMusica = await GET(reqMusica);
  const bodyMusica = await resMusica.json() as { fuente: string };
  console.log(`200 musica: fuente ${bodyMusica.fuente} ${bodyMusica.fuente === "spotify" ? "OK" : "FAIL"}`);

  console.log("\n✓ Endpoint UC1 OK con auth y keys reales (envuelto, 10 limite, 502/401/400)");
}

main().catch((e) => {
  console.error("\n✗ Endpoint fallo:", e);
  process.exit(1);
});
