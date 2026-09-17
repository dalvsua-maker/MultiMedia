// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const dbUrl = process.env.DATABASE_URL ?? "postgresql://usuario:password@localhost:5432/plataforma_contenidos";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });

async function main() {
  console.log("Limpiando fixtures de test en Neon...\n");

  const deletedUsuarios = await prisma.usuario.deleteMany({
    where: {
      OR: [
        { email: { endsWith: "@test.com" } },
        { email: { endsWith: "@example.com" } },
      ],
    },
  });
  console.log(`  usuarios eliminados: ${deletedUsuarios.count}`);

  const deletedContenidos = await prisma.contenido.deleteMany({
    where: {
      OR: [
        { idExterno: { startsWith: "test-" } },
        { idExterno: { startsWith: "tmdb-" } },
        { idExterno: { startsWith: "spot-" } },
        { idExterno: { startsWith: "igdb-" } },
      ],
    },
  });
  console.log(`  contenidos eliminados: ${deletedContenidos.count}`);

  console.log("\nLimpieza completada.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Error en limpieza:", e);
  process.exit(1);
});



