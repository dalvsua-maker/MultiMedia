import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    // Neon: DATABASE_URL (pooled, app/vitest) / DIRECT_URL (direct, migrate).
    // Para migrate: $env:DATABASE_URL=$env:DIRECT_URL; npx prisma migrate deploy
    url:
      process.env.DATABASE_URL ??
      process.env.DIRECT_URL ??
      "postgresql://usuario:password@localhost:5432/plataforma_contenidos",
  },
});
