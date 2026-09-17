# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-09-18

### Fixed
- **Dashboard — “Añadir a Mis contenidos”** (`src/app/dashboard/page.tsx:203`): `handleAddRecomendacion` asumía respuesta `GET /api/contenidos/:id/publico` con wrapper `{contenido: {...}}` (patrón de `GET /api/contenidos/:id`) pero `ObtenerContenidoPublicoUseCase`/`src/app/api/contenidos/[id]/publico/route.ts:14` devuelve objeto plano `ContenidoPublicoDto` `{id, titulo, tipo, fuenteExterna, idExterno, detalle}` (consumo correcto en `src/app/compartido/[id]/page.tsx:66` y test `tests/api/uc5-comparticiones.test.ts:101`). El check `!detail?.contenido` siempre fallaba → mensaje “No se pudo obtener detalle del contenido”. Fix: `const c = detail?.contenido ?? detail; if (!detailRes.ok || !c?.id) throw ...` + `detalle: c.detalle ?? null` (compatible plano y legacy wrapper). Verificado `npm test` 217 passed | 1 skipped, `npm run build` OK, `npm run lint` 0 errores en `src/`.

## [0.2.0] - 2026-09-17

### Added
- **Rediseño recomendaciones V2** (`RecomendacionServiceV2`): pool `TOP50` por `popularidadExterna` (TMDB `popularity`, IGDB `total_rating`, Spotify `popularity`) + `shuffle` → 4 por tipo ×4 tipos=16, afinidad por tipo se mantiene, `yaAnadido` via `historial_usuario_contenido` (badge sutil), 3 votos `me_gusta`/`no_me_gusta`/`ya_lo_vi` con exclusión dura y `DELETE` deshacer (toast único 5s, sin refetch, solo última acción deshacible)
- **Catálogo real 360** (90×4): `scripts/seed_popular_reales.ts` pagina TMDB `/movie/popular`+`/tv/popular` (5 páginas) + IGDB `sort total_rating desc` con `offset` + Spotify múltiples `search` dedup, guarda `popularidadExterna` en `contenidos` + `@@index([popularidadExterna])` (migración `20250917000001_add_popularidad_externa`)
- **Historial y feedback**: `HistorialUsuarioContenido` (upsert al `DELETE /api/usuario-contenido/:cid`) y `RecomendacionFeedback` (`VotoRecomendacion` enum) + migraciones `20250917000000_add_historial_y_feedback` (incluye fix índice parcial `comparticiones` BUG-01)
- **Eliminar de Mis contenidos**: `DELETE /api/usuario-contenido/:cid` (transacción borra `usuario_contenido` + `listaContenido` del usuario + `historial` upsert), `EliminarUsuarioContenidoUseCase`, botones en `/mis-contenidos` (confirm + optimistic) y `/dashboard` `enProceso`
- **Estado en listas**: `ObtenerListaDetalle` ahora incluye `estado` por contenido (`pendiente`/`en_proceso`/`visto`/`Sin estado`) + `PrismaListaRepository.findByIdWithContenidos` hace `LEFT JOIN` historial/estado
- **Adapters**: `TmdbAdapter.obtenerPopulares(tipo, limit, page)` + `IgdbAdapter.obtenerPopulares(limit, offset)` con `total_rating` + `SpotifyAdapter.obtenerPopulares` con `enrichWithPopularity` (`GET /v1/tracks?ids=`) para `popularity` real (search no lo trae con `client_credentials`)
- **Endpoints**: `POST /api/recomendaciones/feedback` + `DELETE /api/recomendaciones/feedback/:cid` + `GET /api/inicio` ahora devuelve `{ enProceso, recomendaciones, recomendacionesPorTipo }` con `yaAnadido` y `Cache-Control: no-store, dynamic='force-dynamic'`
- **Dashboard**: 4 secciones por tipo, `RecomendacionCard` con `Ya añadido`, 3 botones voto + `Añadir`, shuffle cada carga, toast deshacer solo para `no_me_gusta`/`ya_lo_vi` (persiste inmediato, deshace borra feedback y reinserta local; `me_gusta` solo señal)
- **Tests**: `PrismaRecomendacionServiceV2` (pool por `popularidadExterna`, 4×4, conjuntos parcialmente distintos, excluye feedback/historial) + `SpotifyAdapter` actualizado a 5 fetches (enrich)

### Changed
- **Popularidad ya no es dummy**: eliminado enfoque `usuario dummy seed-pop@test.com` con `usuario_contenido` simulado; ranking ahora 100% `popularidadExterna` real
- **Catálogo**: de 13 → 360 reales, sin datos inventados `seed-`
- **Recomendaciones**: de `V1` determinista `p.pop DESC` (10 flat, `JOIN usuario_contenido`) a `V2` aleatorio `TOP50` por `popularidadExterna` + `shuffle`

### Fixed
- **BUG-01** resuelto: índice parcial `comparticiones` ya migrado en `20250917000000`
- **Spotify popularity**: `undefined` en `search` con `client_credentials` → ahora `enrichWithPopularity` vía `GET /v1/tracks?ids=`

### Technical
- Prisma: `VotoRecomendacion` enum + `Contenido.popularidadExterna Float?` + `HistorialUsuarioContenido` + `RecomendacionFeedback` + `migration_lock.toml`
- `prisma.config.ts` ya usaba `DATABASE_URL ?? DIRECT_URL` (Neon pooled/direct)

## [0.1.0] - 2026-09-07

### Added
- Frontend completo para Comparticiones (UC5):
  - Modal "Compartir" en `/mis-contenidos` con buscador de usuarios y botón "Copiar enlace"
  - Página `/comparticiones` con secciones Recibidas/Enviadas, botones Aceptar/Rechazar
  - Página pública `/compartido/:id` con vista previa y botón "Añadir a mi cuenta"
  - Enlace "Comparticiones" en Header
- Unique constraint parcial en BD para prevenir race conditions al compartir
- Migración completa a `next/image` con configuración de dominios externos (TMDB, IGDB, Spotify)

### Fixed
- Compartir duplicado: 2ª vez actualiza `fecha_envio` (200) en lugar de crear fila nueva
- Aceptar compartición: toast informa si contenido ya existía en biblioteca ("Ya tenías este contenido" vs "Añadido a tu biblioteca y compartición aceptada")
- Toast feedback en `/comparticiones` al aceptar/rechazar
- Race condition: unique constraint parcial en BD para estado `pendiente`
- Lint 0 warnings (eliminados 9 warnings `@next/next/no-img-element` y 1 unused var)
- Error handling en `reload()` al quitar contenido de lista

### Changed
- `ResponderComparticionUseCase` retorna `{ comparticion, yaExistia }` para feedback UX diferenciado
- `CompartirContenidoUseCase` lógica confirmada correcta (busca pendiente, actualiza o crea)

### Technical
- Prisma schema: `@@unique([usuarioOrigenId, usuarioDestinoId, contenidoId], where: { estado: "pendiente" })` + `previewFeatures: ["partialIndexes"]`
- `next.config.ts`: `images.remotePatterns` para `image.tmdb.org`, `images.igdb.com`, `i.scdn.co`
- Tests actualizados para nuevo formato de respuesta en `ResponderComparticionUseCase`

## [0.0.1] - 2026-08-26

### Added
- Proyecto base: Next.js 16 + TypeScript + Tailwind 4 + Prisma 7.10 + Neon PostgreSQL
- Arquitectura DDD completa (domain/application/infrastructure)
- UC1: Búsqueda externa unificada (TMDB/IGDB/Spotify)
- UC2: Añadir contenido a biblioteca (+ lista opcional)
- UC3: Listas temáticas (CRUD + items)
- UC4: Estados de contenido (pendiente/en_proceso/visto) con optimistic update
- UC6: Dashboard con en_proceso + recomendaciones
- Auth: register/login con JWT
- Tests: 214 unit/integration tests passing
- CI: lint + test + build pipeline