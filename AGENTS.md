<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Plataforma Contenidos — Notas para agentes

Fuente canonica: `contexto-proyecto-plataforma-contenidos.md` (vision, UCs, contrato API, `schema.prisma` completo). Consultarlo antes de implementar.

## Vision rapida
Plataforma web para buscar/organizar/seguir/compartir contenidos (pelicula, serie, videojuego, musica). Listas tematicas, estados `pendiente -> en_proceso -> visto`, busqueda unificada (TMDB/IGDB/Spotify), compartir con aceptar/rechazar, home con `enProceso` + `recomendaciones` (v1: afinidad por tipo + popularidad, excluye contenidos ya poseidos en cualquier estado).

## Stack y arquitectura
- **Full-stack Next.js 16 App Router + TypeScript strict + Tailwind 4**. Route Handlers `src/app/api/**/route.ts` son el backend — no hay servidor separado.
- **DB: PostgreSQL (Neon `plataforma-contenidos-dev`, branch `main` en prod) + Prisma 7.10** (`@prisma/client` 7.10, `prisma` 7.10, `@prisma/adapter-pg` + `pg`). Singleton Prisma en `src/infrastructure/database/prisma.ts` vía `PrismaPg` (requiere `?sslmode=require` en Neon).
- **DDD implementado** (UC1-UC6 verde, backend completo): `src/domain/{entities,repositories,services}`, `src/application/{dtos,use-cases,errors}`, `src/infrastructure/{database,repositories,auth,services}` + `src/app/api/{auth, listas, contenidos, contenidos/buscar, contenidos/:id/publico, usuarios/buscar, usuario-contenido, comparticiones, inicio}`. UC1: `IExternalSearchService` + `TmdbAdapter`/`IgdbAdapter`/`SpotifyAdapter` (fetch 5s, límite 10, cache token) + `BuscarContenidoUseCase` (auth Bearer, `{resultados,total,fuente}`). UC2: `POST /api/contenidos` (200 idempotente `yaExistia`, `listaId` opcional) + `GET /api/contenidos/:id` (`{contenido,estadoUsuario}`). UC4: `GET /api/usuario-contenido` + `PATCH /api/usuario-contenido/:cid` (retroceso libre `pendiente|en_proceso|visto`, idempotente). UC5: `GET /api/contenidos/:id/publico` (SIN auth) + `GET /api/usuarios/buscar?q=` (auth, `q≥2`, `ILIKE`, limite 10, sin email) + `POST|GET /api/comparticiones` + `PATCH /api/comparticiones/:id` (200 reenvío si pendiente duplicado, 201 tras rechazada, 403/404/409). UC6: `GET /api/inicio` (`enProceso` filtrado `en_proceso` + `recomendaciones` v1 afinidad tipo ASC determinista + popularidad, excluye todo `usuario_contenido`, fallback populares globales, límite 10).
- Alias ` @/* -> src/*` en `tsconfig.json:21` — usar en imports.
- Auth: `bcryptjs` + `jsonwebtoken` (tipos en `devDependencies`). Tests: `vitest` (`npm test`).

## Comandos verificados
```bash
npm run dev          # next dev
npm run build        # next build
npm run lint         # eslint (eslint-config-next core-web-vitals + typescript)
npm test             # vitest run (214 tests, 1 skipped sin TMDB_API_KEY, 5 integración pasan con Neon)
npm run test:watch   # vitest watch
npx tsx scripts/limpiar-fixtures.ts   # borra fixtures de test (email @test.com/@example.com, idExterno test-/tmdb-/spot-/igdb-) de Neon — usar solo si un test deja residuos
npx prisma generate
npx prisma migrate deploy                  # prod/Neon — usa DIRECT_URL (ver scripts/neon-setup.md)
DATABASE_URL="<pooled>?sslmode=require" npx prisma migrate deploy  # si solo hay pooled
npx prisma migrate dev --name <msg>        # crea migración timestamped en prisma/migrations/
npx prisma db execute --file=prisma/001_schema_inicial.sql  # fallback SQL manual (no trazado)
docker compose up -d                       # fallback local Postgres 16 (5432)
```
`postinstall` ejecuta `prisma skills sync || exit 0` — no lanzar manual salvo regenerar skills. `.env` gitignoreado — ver `scripts/neon-setup.md` para dual `DATABASE_URL` (pooled app/vitest) + `DIRECT_URL` (migrate).

## Modelo de datos — claves que rompen si se ignoran
- Enums: `TipoContenido {pelicula,serie,videojuego,musica}`, `FuenteExterna {tmdb,igdb,spotify}`, `EstadoContenido {pendiente,en_proceso,visto}`, `EstadoComparticion {pendiente,aceptada,rechazada}`.
- `Contenido @@unique([fuenteExterna, idExterno])` — UC2 debe buscar por esa tupla y reutilizar, nunca duplicar. Detalles 1:1 `DetallePelicula|Serie|Videojuego|Musica` con `onDelete: Cascade`.
- `UsuarioContenido PK [usuarioId,contenidoId]` + `@@index([usuarioId])`; `ListaContenido PK [listaId,contenidoId]`; `Comparticion @@index([usuarioDestinoId, estado]) + @@unique([usuarioOrigenId, usuarioDestinoId, contenidoId], where: { estado: "pendiente" }) (partialIndexes, previewFeatures)`.
- `DATABASE_URL` en `.env` (gitignoreado). `prisma/schema.prisma` existe en disco — fuente literal es disco; `contexto-proyecto:Sec 5` es copia verificada 2026-09-10. `prisma.config.ts` define `datasource.url` (Prisma 7, requiere `?sslmode=require` en Neon) — no copiar url de doc.

## Contrato API
```
POST   /api/auth/register | /api/auth/login          # JWT
GET    /api/contenidos/buscar?tipo=&q=                # UC1 externo
POST   /api/contenidos | GET /api/contenidos/:id      # UC2
GET    /api/contenidos/:id/publico                    # UC5 publico SIN auth (no expone estadoUsuario)
GET    /api/usuarios/buscar?q=                        # UC5 buscar usuarios (auth, q>=2, ILIKE asc, limit 10, sin email)
GET|POST /api/listas | GET /api/listas/:id            # UC3
POST   /api/listas/:id/contenidos | DELETE /api/listas/:id/contenidos/:cid
GET    /api/usuario-contenido | PATCH /api/usuario-contenido/:cid  # UC4
POST|GET /api/comparticiones | PATCH /api/comparticiones/:id       # UC5
GET    /api/inicio -> { enProceso, recomendaciones }  # UC6
```

## Reglas de negocio (UC1-UC6)
- UC1: `tipo` obligatorio (`pelicula|serie→tmdb`, `videojuego→igdb`, `musica→spotify`), `q` ≥2, `limit 10`, `timeout 5s`, respuesta envuelta `{resultados,total,fuente}`, 502 si externo cae, 401 sin Bearer.
- UC2: check `@@unique` antes de `create`; crea `UsuarioContenido(pendiente)` y opcional `ListaContenido`.
- UC4: transicion libre `pendiente|en_proceso|visto` sobre `usuario_contenido.estado` (retroceso permitido, idempotente mismo estado).
- UC5: `GET /api/contenidos/:id/publico` SIN auth (no expone `estadoUsuario`) + `GET /api/usuarios/buscar?q=` (`q≥2`, `ILIKE` asc, limite 10, sin email, excluye auth) + `POST /api/comparticiones` (`200` reenvío si pendiente duplicado con `fecha_envio` update, `201` si nueva tras `rechazada`, `400` auto-compartir) + `PATCH /api/comparticiones/:id` (`aceptar`→`aceptada` + `usuario_contenido(pendiente)` idempotente, `rechazar`→`rechazada`, `403` no destinatario, `409` si ya no `pendiente`).
- UC6: `enProceso = usuarioContenido where estado=en_proceso`; `recomendaciones` = tipo mas consumido + popularidad, **excluyendo** todo `usuario_contenido` del usuario.

## Convenciones y gotchas
- Leer `node_modules/next/dist/docs/` antes de asumir APIs de Next 16 (breaking changes, ver bloque header).
- `prisma.config.ts` usa `defineConfig` + `datasource.url` (Prisma 7) — no mover; `@prisma/adapter-pg` requiere `?sslmode=require` en Neon.
- Dual `DATABASE_URL` (pooled) / `DIRECT_URL` (direct) — ver `scripts/neon-setup.md` + `docker-compose.yml` (fallback local, `usuario:password@localhost:5432`). `.env` gitignoreado.
- Migraciones C1 con timestamp: `prisma/migrations/20250826000000_001_schema_inicial/migration.sql` (historial trazado en `_prisma_migrations`); fallback `prisma/001_schema_inicial.sql`.
- **Tests de integración vs Neon**: nunca usar `prisma.x.deleteMany()` sin `where` en tests de integración — wipea datos reales. Usar `cleanupFixtures(prisma)` de `tests/integration/_cleanup.ts` (borra filas relacionadas con contenidos `idExterno LIKE 'test-%'|'tmdb-%'|'spot-%'|'igdb-%'` y usuarios `email LIKE '%@test.com'|'%@example.com'`). Si quedaron residuos en Neon, ejecutar `npx tsx scripts/limpiar-fixtures.ts`.
- Validar con `npm test && npm run lint && npm run build` antes de PR; integración `PrismaListaRepository` hace skip si `DATABASE_URL` no responde.
- `CLAUDE.md` es solo `@AGENTS.md` — no duplicar instrucciones.

## Páginas
- `/dashboard` (auth): en_proceso + recomendaciones (UC6) — solo `GET /api/inicio`.
- `/buscar` (auth): UC1 + botón añadir (UC2).
- `/mis-contenidos` (auth): lista completa del usuario con `GET /api/usuario-contenido`, badge de estado, botones selector (3 estados, retroceso libre) que llama `PATCH /api/usuario-contenido/:cid` con optimistic update + rollback, filtros pill (Todos/Pendiente/En proceso/Visto).
- `/listas`, `/listas/:id` (auth): UC3.
- `/comparticiones` (auth): UC5 — recibidas/enviadas, botones aceptar/rechazar con toast feedback.
- `/compartido/:id` (público): vista previa sin auth, botón "Añadir a mi cuenta" si logueado.

## Comparticiones (UC5) — Fixes aplicados (sep 2026)
- `ResponderComparticionUseCase` devuelve `{ comparticion, yaExistia }` para feedback UX diferenciado.
- `/comparticiones` page muestra toast: "Ya tenías este contenido" vs "Añadido a tu biblioteca y compartición aceptada" / "Compartición rechazada".
- Unique constraint parcial en `Comparticion`: `@@unique([usuarioOrigenId, usuarioDestinoId, contenidoId], where: { estado: "pendiente" })` + `previewFeatures: ["partialIndexes"]` en generator.
- Migración `<img>` → `<Image />` completa (7 instancias) + `next.config.ts` con `remotePatterns` para TMDB/IGDB/Spotify.
- Lint 0 warnings (eliminados 9 warnings `@next/next/no-img-element` y 1 unused var).
