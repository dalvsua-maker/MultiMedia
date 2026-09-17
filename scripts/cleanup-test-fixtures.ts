// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL no definida en .env");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  const contenidosBorrados = await prisma.contenido.deleteMany({
    where: { idExterno: { startsWith: "test-" } },
  });

  const usuariosBorrados = await prisma.usuario.deleteMany({
    where: { email: { endsWith: "@test.com" } },
  });

  console.log(`Contenido borrado: ${contenidosBorrados.count}`);
  console.log(`Usuarios borrados: ${usuariosBorrados.count}`);

  const restantes = await prisma.contenido.count({
    where: { idExterno: { startsWith: "test-" } },
  });
  console.log(`Contenidos test restantes: ${restantes}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });



