// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no definida en .env");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const usuariosTest = await prisma.usuario.count({
    where: { email: { contains: "@test.com" } },
  });
  const contenidosTest = await prisma.contenido.count({
    where: { OR: [
      { idExterno: { startsWith: "test-" } },
      { idExterno: { startsWith: "tmdb-test-" } },
      { idExterno: { startsWith: "tmdb-c1-" } },
      { idExterno: { startsWith: "tmdb-c2-" } },
      { idExterno: { startsWith: "tmdb-emp" } },
      { idExterno: { startsWith: "sp-det-" } },
      { idExterno: { startsWith: "igdb-det-" } },
      { idExterno: { startsWith: "udet-" } },
    ] },
  });

  console.log(`Usuarios con email @test.com: ${usuariosTest}`);
  console.log(`Contenidos con idExterno de test: ${contenidosTest}`);
  console.log("--- muestra ---");
  const muestra = await prisma.contenido.findMany({
    where: { OR: [
      { idExterno: { startsWith: "test-" } },
      { idExterno: { startsWith: "tmdb-test-" } },
      { idExterno: { startsWith: "tmdb-c1-" } },
      { idExterno: { startsWith: "tmdb-c2-" } },
      { idExterno: { startsWith: "tmdb-emp" } },
      { idExterno: { startsWith: "sp-det-" } },
      { idExterno: { startsWith: "igdb-det-" } },
      { idExterno: { startsWith: "udet-" } },
    ] },
    take: 20,
    select: { id: true, titulo: true, idExterno: true, imagenUrl: true },
  });
  for (const c of muestra) console.log(`  ${c.titulo.padEnd(20)} idExterno=${c.idExterno.padEnd(30)} imagen=${c.imagenUrl ?? "null"}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });



