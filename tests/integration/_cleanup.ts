import { PrismaClient } from "@prisma/client";

export const FIXTURE_EMAIL_DOMAINS = ["@test.com", "@example.com"] as const;
export const FIXTURE_ID_EXTERNO_PREFIXES = ["test-", "tmdb-", "spot-", "igdb-"] as const;

const idExternoOr = FIXTURE_ID_EXTERNO_PREFIXES.map((p) => ({ idExterno: { startsWith: p } }));
const emailOr = FIXTURE_EMAIL_DOMAINS.map((d) => ({ email: { endsWith: d } }));

export async function cleanupFixtures(prisma: PrismaClient): Promise<void> {
  await prisma.listaContenido.deleteMany({
    where: { contenido: { OR: idExternoOr } },
  });
  await prisma.usuarioContenido.deleteMany({
    where: { contenido: { OR: idExternoOr } },
  });
  await prisma.comparticion.deleteMany({
    where: { contenido: { OR: idExternoOr } },
  });
  await prisma.detallePelicula.deleteMany({
    where: { contenido: { OR: idExternoOr } },
  });
  await prisma.detalleSerie.deleteMany({
    where: { contenido: { OR: idExternoOr } },
  });
  await prisma.detalleVideojuego.deleteMany({
    where: { contenido: { OR: idExternoOr } },
  });
  await prisma.detalleMusica.deleteMany({
    where: { contenido: { OR: idExternoOr } },
  });
  await prisma.contenido.deleteMany({ where: { OR: idExternoOr } });
  await prisma.lista.deleteMany({
    where: { usuario: { OR: emailOr } },
  });
  await prisma.usuario.deleteMany({ where: { OR: emailOr } });
}

