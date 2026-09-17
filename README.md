# Plataforma Contenidos — Next.js 16 + Prisma 7 + Neon

Plataforma web para buscar/organizar/seguir/compartir contenidos (película, serie, videojuego, música) con listas temáticas, estados `pendiente → en_proceso → visto`, búsqueda unificada (TMDB/IGDB/Spotify), compartición con aceptar/rechazar y home con recomendaciones V2.

## Stack

- **Next.js 16 App Router** + TypeScript strict + Tailwind 4
- **PostgreSQL (Neon)** + **Prisma 7.10** (`@prisma/adapter-pg`, `prisma.config.ts` con `DATABASE_URL` pooled / `DIRECT_URL` direct, `?sslmode=require`)
- **DDD**: `src/domain`, `src/application`, `src/infrastructure` + Route Handlers `src/app/api/**/route.ts`
- **Auth**: `bcryptjs` + `jsonwebtoken` — **Tests**: `vitest` (217 tests)

## Catálogo

360 contenidos reales (90 por tipo) con `popularidadExterna` (TMDB `popularity`, IGDB `total_rating`, Spotify `popularity`), `@@index([popularidadExterna])`. Seed: `npx tsx scripts/seed_popular_reales.ts` (pagina TMDB/IGDB/Spotify, dedup por `@@unique([fuenteExterna,idExterno])`).

## Quick start

```bash
npm install
cp .env.example .env # rellena DATABASE_URL, DIRECT_URL, JWT_SECRET, TMDB_API_KEY, IGDB_*, SPOTIFY_*
npx prisma migrate deploy # usa DIRECT_URL
npm run dev
```

Env dual Neon: `DATABASE_URL` (pooled, app/vitest) + `DIRECT_URL` (direct, migrate) — ver `scripts/neon-setup.md`.

## Comandos

```bash
npm run dev
npm run build
npm run lint
npm test              # 217 passed | 1 skipped (sin TMDB_API_KEY)
npx tsx scripts/limpiar-fixtures.ts
npx tsx scripts/seed_popular_reales.ts
```

## API (resumen)

```
POST   /api/auth/register | /api/auth/login
GET    /api/contenidos/buscar?tipo=&q=          # UC1
POST   /api/contenidos | GET /api/contenidos/:id
GET    /api/contenidos/:id/publico
GET    /api/usuarios/buscar?q=
GET|POST /api/listas | GET /api/listas/:id
POST   /api/listas/:id/contenidos | DELETE /api/listas/:id/contenidos/:cid
GET    /api/usuario-contenido | PATCH /api/usuario-contenido/:cid | DELETE /api/usuario-contenido/:cid
POST|GET /api/comparticiones | PATCH /api/comparticiones/:id
GET    /api/inicio -> { enProceso, recomendaciones, recomendacionesPorTipo } # UC6 V2 4×4 + yaAnadido
POST   /api/recomendaciones/feedback | DELETE /api/recomendaciones/feedback/:cid
```

Ver `contexto-proyecto-plataforma-contenidos.md` (fuente canónica) y `AGENTS.md` (notas para agentes).

## Recomendaciones V2

Pool `TOP50` por `popularidadExterna` por tipo → `shuffle` → 4, excluye `usuario_contenido` + `feedback(no_me_gusta,ya_lo_vi)`, badge `Ya añadido` via `historial_usuario_contenido`, 3 votos con deshacer (toast único 5s, solo última).

## Docs

- `contexto-proyecto-plataforma-contenidos.md` — visión, UCs, contrato, schema completo
- `AGENTS.md` — notas operativas breves
- `docs/AUDITORIA-2026-09-10.md` — auditoría histórica
- `docs/REDISENO-2026-09-17.md` — rediseño V2 (dummy → popularidad real, 360 catálogo, TOP50)
- `CHANGELOG.md` — historial

## Deploy

`npx prisma migrate deploy` con `DIRECT_URL`, luego `npm run build` (18 `ƒ Dynamic` + 6 `○ Static`).
