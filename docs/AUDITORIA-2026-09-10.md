# Auditoría de Resincronización — Plataforma Contenidos — 2026-09-10

> **Alcance:** PASO 1 (auditoría read-only) + PASO 2 (informe de discrepancias) — ejecutado sin modificar código funcional. PASO 3 (5 correcciones doc) aplicado sobre `contexto-proyecto-plataforma-contenidos.md` y `AGENTS.md` sin commit. Informe escrito en `docs/AUDITORIA-2026-09-10.md`.

**Metodología:** Lectura de `node_modules/next/dist/docs/` (452 ficheros, App Router confirmado), `git log/status`, `prisma/schema.prisma` vs bloque Prisma doc, `prisma.config.ts`, `prisma/migrations/`, `npx prisma migrate status`, `npx prisma migrate diff` (dos direcciones), `npm test -- --run`, `npm run lint`, `npm run build`, escaneo `src/app/api/**/route.ts` (16 routes) vs `src/application/use-cases/**` (18 use-cases).

**Resultado Build/Test real (no lo que dicen los docs):**

| Comando | Salida real | Estado |
|---------|-------------|--------|
| `git log --oneline -20` / `git status` | `fatal: not a git repository` — `.git` no existe en `C:\Users\Dani\Desktop\plataforma-contenidos\` | ⚠️ Repo no versionado (no hay historial para auditar) |
| `prisma/schema.prisma` existe | `5687 bytes, 2026-09-07 17:08` — existe | ✅ |
| `prisma.config.ts` | `defineConfig` con `datasource.url = DATABASE_URL ?? DIRECT_URL ?? localhost` (Prisma 7) | ✅ |
| `prisma/migrations/` | 1 migración: `20250826000000_001_schema_inicial/migration.sql` (6154 bytes) + fallback `prisma/001_schema_inicial.sql` idéntico | ✅ |
| `npx prisma migrate status` (con `.env` Neon cargado) | `1 migration found in prisma/migrations — Database schema is up to date!` (Neon `neondb` @ `ep-still-night-zay32jdv-pooler`) | ⚠️ Ver drift parcial abajo |
| `npx prisma migrate diff --from-config-datasource --to-schema --script` | `CREATE UNIQUE INDEX "comparticiones_usuario_origen_id_usuario_destino_id_conteni_key" ON "comparticiones"(...) WHERE ("estado" = 'pendiente')` | 🔴 Schema tiene índice que DB no tiene |
| `npx prisma migrate diff --from-schema --to-config-datasource --script` | `DROP INDEX "public"."comparticiones_usuario_origen_id_usuario_destino_id_conteni_key"` | Confirma drift inverso |
| `npm run lint` | Sin salida (0 warnings, exit 0) — `eslint` con `eslint-config-next` OK | ✅ coincide con AGENTS "0 warnings" |
| `npm test -- --run` | `Test Files 26 passed / Tests 214 passed | 1 skipped` (12.14s) — vitest 4.1.11 | ✅ coincide con AGENTS "214 tests 1 skipped" |
| `npm run build` (Next 16.3.3 Turbopack) | `✓ Compiled successfully in 4.7s` — 16 `ƒ Dynamic` routes + 7 `○ Static` | ✅ |

**Rutas build (Next):** `ƒ /api/auth/login, /api/auth/register, /api/comparticiones, /api/comparticiones/[id], /api/contenidos, /api/contenidos/[id], /api/contenidos/[id]/publico, /api/contenidos/buscar, /api/inicio, /api/listas, /api/listas/[id], /api/listas/[id]/contenidos, /api/listas/[id]/contenidos/[cid], /api/usuario-contenido, /api/usuario-contenido/[cid], /api/usuarios/buscar` — 16 exactas, mapean 1:1 con `src/app/api/**/route.ts`.

---

## a) Discrepancias entre `contexto-proyecto-plataforma-contenidos.md` y el repo real

| # | Dice el documento | Hay realmente en el repo | Recomendación (¿cuál es la verdad?) | Severidad |
|---|-------------------|--------------------------|--------------------------------------|-----------|
| **C-01** | `contexto-proyecto:111-118` bloque schema: `datasource db { provider="postgresql" url=env("DATABASE_URL") }` + `generator client { provider="prisma-client-js" }` sin `previewFeatures` | `prisma/schema.prisma:1-7` real: `datasource db { provider="postgresql" }` **sin `url`** + `generator client { previewFeatures=["partialIndexes"] }` + URL movida a `prisma.config.ts:7-12` (`defineConfig` + `DATABASE_URL ?? DIRECT_URL ?? localhost`) | **Repo es verdad** (Prisma 7 migración). Actualizar Sec 5 a volcado literal de `prisma/schema.prisma` + documentar `prisma.config.ts` pattern. Doc obsoleto Prisma 6. | **Alta** |
| **C-02** | `contexto-proyecto:240` y `252`: `ListaContenido` y `UsuarioContenido` usan `@@primaryKey([listaId, contenidoId])` / `@@primaryKey([usuarioId, contenidoId])` | `prisma/schema.prisma:106`, `119`: usan `@@id([listaId, contenidoId])` / `@@id([usuarioId, contenidoId])` (Prisma 7.10 correcto, `@@primaryKey` deprecated) | **Repo es verdad**. Actualizar doc a `@@id`. | **Media** |
| **C-03** | `contexto-proyecto:257-270`: `Comparticion` solo tiene `@@index([usuarioDestinoId, estado])` | `prisma/schema.prisma:154-158`: tiene `@@index([usuarioDestinoId, estado])` **+** `@@unique([usuarioOrigenId, usuarioDestinoId, contenidoId], where:{estado:"pendiente"})` + generator `partialIndexes` | **Repo es verdad** (fix sep 2026). Doc omitió el índice único parcial que previene race condition `POST /api/comparticiones` duplicado. **Actualizado en PASO 3.** | **Alta** |
| **C-04** | `contexto-proyecto:76-104` Contrato API REST: lista 10 endpoints, **sin** `GET /api/contenidos/:id/publico` ni `GET /api/usuarios/buscar?q=` | Repo: `src/app/api/contenidos/[id]/publico/route.ts` (`ObtenerContenidoPublicoUseCase`) SIN auth + `src/app/api/usuarios/buscar/route.ts` (`BuscarUsuariosUseCase`) con auth `q≥2, ILIKE, limit 10` — ambos con build `ƒ` y tests `uc5-comparticiones` | **Repo es verdad**. Añadir al contrato Sec 4 con reglas auth (público sin auth, usuarios/buscar con auth). **Actualizado en PASO 3.** | **Alta** |
| **C-05** | `contexto-proyecto:29-59` Estructura DDD target: `src/domain/{entities,repositories,services}` + `src/infrastructure/{database,repositories,services}` pero diagrama `app/api/{auth,contenidos,inicio,listas,usuario-contenido,comparticiones}` — falta `usuarios/buscar` y `contenidos/:id/publico` | Repo: `src/app/api/usuarios/buscar`, `src/app/api/contenidos/[id]/publico`, `src/app/api/_helpers/auth.ts`, `src/infrastructure/services/fetchWithTimeout.ts` + `ExternalSearchService.ts` — estructura real más completa | **Repo es verdad**. Actualizar diagrama target Sec 2 para incluir ambas rutas y helpers. | **Media** |
| **C-06** | `contexto-proyecto:275-290` Estado Actual: "Fase de Análisis/Diseño 100%, próximas tareas: inicializar Next.js, configurar Prisma, crear DDD, implementar Auth..." (estado pre-implementación agosto 2026) | Repo: UC1-UC6 implementados verde (16 routes, 18 use-cases, 7 DTOs, 5 repos Prisma, 3 adapters externos, RecomendacionServiceV1, 214 tests pass, lint 0, build OK, páginas `/dashboard, /buscar, /mis-contenidos, /listas, /comparticiones, /compartido/:id`) | **Repo es verdad**. Reescribir Sec 6 con tabla honesta fecha 2026-09-10 + `CHANGELOG.md:0.1.0`. **Actualizado en PASO 3.** | **Alta** |

**Evidencia C-01/C-02/C-03:** Diff literal `contexto:110-271` vs `prisma/schema.prisma` (160 líneas) — 5 diferencias: `url`, `previewFeatures`, `@@id` vs `@@primaryKey` (2 modelos), `@@unique` parcial faltante. `prisma/migrations/.../migration.sql` (172 líneas) y `prisma/001_schema_inicial.sql` (172 líneas) idénticos y **también sin** índice parcial → migración no generada para el fix.

---

## b) Discrepancias entre `AGENTS.md` y el repo real

| # | Dice AGENTS.md | Hay realmente en el repo | Recomendación (¿cuál es la verdad?) | Severidad |
|---|----------------|--------------------------|--------------------------------------|-----------|
| **A-01** | `AGENTS.md:46`: "`Sin prisma/schema.prisma en disco aun — copiar verbatim de contexto-proyecto:110-271`" | `prisma/schema.prisma` existe (5687 bytes, 2026-09-07) + `prisma.config.ts` existe | **Repo es verdad**. Frase obsoleta pre-implementación. **Corregido en PASO 3**: reemplazado por "`prisma/schema.prisma` existe en disco — fuente literal es disco; `contexto-proyecto:5` es copia verificada 2026-09-10 + `prisma.config.ts` define `datasource.url` (Prisma 7)." | **Alta** |
| **A-02** | `AGENTS.md:45`: "`UsuarioContenido PK [usuarioId,contenidoId]` + `@@index([usuarioId])`; `ListaContenido PK [listaId,contenidoId]`; `Comparticion @@index([usuarioDestinoId, estado])`" — omite el `@@unique` parcial | `prisma/schema.prisma:154-158`: `Comparticion` tiene `@@index` **+** `@@unique([usuarioOrigenId,usuarioDestinoId,contenidoId], where:{estado:"pendiente"})` + `previewFeatures` | **Repo es verdad**. **Corregido en PASO 3**: ampliado a "`Comparticion @@index([usuarioDestinoId, estado]) + @@unique([usuarioOrigenId,usuarioDestinoId,contenidoId], where:{estado:"pendiente"}) (partialIndexes)`". | **Alta** |
| **A-03** | `AGENTS.md:48-58` Contrato API bloque: 6 líneas, **sin** `GET /api/contenidos/:id/publico` ni `GET /api/usuarios/buscar` en el bloque (solo mencionados en prosa `AGENTS.md:21` / `64`) | Repo: ambos existen, documentados en prosa pero ausentes del bloque contrato | **Repo es verdad**. **Corregido en PASO 3**: bloque contrato ampliado a 8 líneas incluyendo `GET /api/contenidos/:id/publico (SIN auth, UC5)` y `GET /api/usuarios/buscar?q= (auth, q≥2, ILIKE, limit10, UC5)`. | **Media** |
| **A-04** | `AGENTS.md:30`: "`npm test` (214 tests, 1 skipped sin TMDB_API_KEY, 5 integración pasan con Neon)" | `npm test -- --run` real 2026-09-10: `Test Files 26 passed / Tests 214 passed | 1 skipped` — coincide. `5 integración` no desglosado en vitest output pero `tests/integration/` tiene 5 ficheros (`PrismaComparticion, PrismaContenido, PrismaLista, PrismaRecomendacion, PrismaUsuarioContenido`) + `_cleanup.ts` | **Doc es verdad** (verificado). No requiere corrección, solo confirmación en informe. | Info |
| **A-05** | `AGENTS.md:71`: "Migraciones C1 con timestamp: `prisma/migrations/20250826000000_001_schema_inicial/migration.sql` + fallback `prisma/001_schema_inicial.sql`" | Real: 1 migración exacta, fallback idéntico — coincide. **Pero** migración no incluye índice parcial (drift) | **Doc parcialmente verdad**. Falta notar que fix sep 2026 no tiene migración. **Anotado como hallazgo BUG-01**, no corregido en doc como "migración pendiente" hasta PASO 3. | **Alta** |
| **A-06** | `AGENTS.md:20`: DDD implementado menciona `src/app/api/{auth, listas, contenidos, contenidos/buscar, contenidos/:id/publico, usuarios/buscar, usuario-contenido, comparticiones, inicio}` — lista completa | Repo: lista completa 16 routes coincide | **Doc es verdad**. No discrepancia. | — |
| **A-07** | `AGENTS.md:84-89` Fixes sep 2026: único doc que menciona `previewFeatures` + `@@unique` parcial + `next.config.ts remotePatterns` + `next/image` (7 instancias) + lint 0 | Repo: `next.config.ts:5-9` tiene `remotePatterns` 3 hosts, `npm run lint` 0 warnings, `ResponderComparticionUseCase` devuelve `{comparticion, yaExistia}` | **Doc es verdad**. No discrepancia, pero `contexto` no lo tenía → contradicción entre docs (ver c). | — |

---

## c) Contradicciones entre ambos documentos entre sí

| # | `contexto-proyecto` dice | `AGENTS.md` dice | Repo dice | ¿Cuál es la verdad? |
|---|--------------------------|------------------|-----------|---------------------|
| **X-01** | Sec 5 sin `previewFeatures` ni `@@unique` parcial (Prisma 6 style) | Sec "Fixes sep 2026" con `previewFeatures` + `@@unique` parcial + Sec 42-46 omite parcial en claves pero lo menciona en fixes | Repo: con `previewFeatures` + `@@unique` parcial en `prisma/schema.prisma:4,158` | **AGENTS + repo** (fix real). Contexto desactualizado. **Corregido en PASO 3.** |
| **X-02** | Contrato Sec 4 (10 endpoints) sin `/publico` ni `/usuarios/buscar` | Contrato bloque 48-58 también sin ambos, pero prosa 21/64 sí los describe con auth correcto | Repo: ambos existen | **AGENTS prosa + repo**. Ambos contratos de ambos docs incompletos. **Corregidos en PASO 3.** |
| **X-03** | Sec 6: pre-implementación (inicializar proyecto...) | Sec "Stack DDD implementado UC1-UC6 verde" + fixes sep 2026 + páginas `/dashboard.../compartido/:id` | Repo: UC1-UC6 verde, build OK | **AGENTS + repo**. Contexto Sec 6 obsoleto. **Corregido en PASO 3.** |
| **X-04** | Diagrama target `app/api/{auth,contenidos,inicio,listas,usuario-contenido,comparticiones}` sin `usuarios` | `src/app/api/{auth,listas,contenidos,...,usuarios/buscar}` completo | Repo: con `usuarios/buscar` | **AGENTS + repo**. |
| **X-05** | Sintaxis `@@primaryKey` | `@@id` en "claves que rompen" (PK) + `@@unique` parcial con `where` | Repo: `@@id` | **Repo + AGENTS** (Prisma 7). Contexto usa sintaxis deprecated. |

---

## Hallazgos aparte (bugs / riesgos — no corregir código en esta tarea, solo reportar)

| ID | Hallazgo | Evidencia | Impacto | Recomendación |
|----|----------|-----------|---------|---------------|
| **BUG-01** | **Migración faltante para índice único parcial `Comparticion`** — `prisma/schema.prisma:158` tiene `@@unique(..., where:{estado:"pendiente"})` pero `prisma/migrations/20250826000000_001_schema_inicial/migration.sql` y `prisma/001_schema_inicial.sql` **no** contienen `CREATE UNIQUE INDEX ... WHERE ("estado"='pendiente')` ni `migration_lock.toml` para detectar drift. `npx prisma migrate diff --from-config-datasource --to-schema` confirma `CREATE UNIQUE INDEX` pendiente; inverso confirma `DROP`. `migrate status` dice "up to date" porque compara contra `_prisma_migrations` (1 fila), no contra schema drift. | `prisma diff --to-schema` output `CREATE UNIQUE INDEX ... WHERE ("estado"='pendiente')`; `Select-String migration.sql -Pattern UNIQUE` solo muestra 2 índices (`usuarios_email`, `contenidos_fuente...`), no el parcial | **Alta**: En Neon prod, race condition `POST /api/comparticiones` con duplicado pendiente no está protegido a nivel DB; solo `findPendiente` + `updateFechaEnvio` en `CompartirContenidoUseCase:57-70`. Bajo concurrencia puede crear duplicados `pendiente`. | Generar migración: `npx prisma migrate dev --name add_partial_unique_comparticion_pendiente` (requiere `DIRECT_URL`), verificar `migration.sql` contiene `CREATE UNIQUE INDEX ... WHERE`, ejecutar `npx prisma migrate deploy` en Neon (`DIRECT_URL`), y actualizar `prisma/001_schema_inicial.sql` o marcarlo deprecated. |
| **BUG-02** | **`.git` no existe** — workspace no es repo git (`git log/status` → `fatal: not a git repository`). No hay historial para auditar commits del fix sep 2026, ni `_prisma_migrations` trazabilidad en remoto, ni `CHANGELOG.md` versionado. | `Test-Path .git` = False; `Get-ChildItem -Force` sin `.git` | **Media**: No se puede verificar `git diff` del fix, ni hacer `git log --oneline -20` pedido en PASO 1. Riesgo de pérdida de trazabilidad. | Inicializar `git init`, primer commit con `.gitignore` (ya ignora `.env*`, `.next/`, `node_modules`), y push a remoto. Hasta entonces, auditoría basada en FS +build. |
| **BUG-03** | **Fallback `prisma/001_schema_inicial.sql` desincronizado** — es byte-idéntico a `migration.sql` (6154 bytes) y también sin índice parcial. Si se usa como fallback manual (`npx prisma db execute --file=prisma/001_schema_inicial.sql` per `AGENTS.md:37`), dejará DB sin constraint. | `Get-ChildItem prisma` muestra ambos 6154 bytes; `Compare-Object` idénticos | **Media** | Documentar que `001_schema_inicial.sql` es snapshot inicial sin fix sep 2026; tras BUG-01, regenerar o eliminar fallback y usar solo `migrations/`. |
| **INFO-01** | **Vitest config warning** — `vitest.config.ts` ESM loaded as CommonJS (`(!) Your Vite config uses features that are unsupported by configLoader: 'native'`) — no falla pero warn en `npm test`. | `npm test` stdout warning `configLoader: 'native'` | Baja | Migrar `vitest.config.ts` → `vitest.config.mjs` o añadir `"type":"module"` o set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` si molesta. No bloquea. |
| **INFO-02** | **Prisma 7 `datasource.url` en `prisma.config.ts`** — patrón correcto pero dual `DATABASE_URL` (pooled) / `DIRECT_URL` (direct) solo documentado en `scripts/neon-setup.md` y `AGENTS.md:40` — `contexto` no lo menciona. | `prisma.config.ts:7-12` | Baja | Añadido en Sec 5 nota tras corrección C-01. |

---

## Verificación por UC (PASO 1 detalle — 16 routes × 18 use-cases)

| UC | Ruta(s) `src/app/api/**/route.ts` | Use-case `src/application/use-cases/**` | Contrato doc vs real | Estado |
|----|-----------------------------------|-----------------------------------------|----------------------|--------|
| **UC1** | `GET /api/contenidos/buscar` (`buscar/route.ts`) | `BuscarContenido.ts` → `Tmdb/Igdb/SpotifyAdapter` + `ExternalSearchService` + `fetchWithTimeout` (5s, limit 10) | Doc `tipo` obligatorio, `q≥2`, `{resultados,total,fuente}`, 502 externo, 401 sin Bearer — verificado en código (auth `getAuthenticatedUserId`, 401 `UnauthorizedError`) | ✅ Verde |
| **UC2** | `POST /api/contenidos` (`contenidos/route.ts`) + `GET /api/contenidos/:id` (`[id]/route.ts`) | `CrearContenido.ts` (check `@@unique([fuenteExterna,idExterno])` reuse) + `ObtenerContenidoDetalle.ts` (`{contenido,estadoUsuario}`) | Doc 200 idempotente `yaExistia` + `listaId` opcional — verificado | ✅ Verde |
| **UC3** | `GET|POST /api/listas`, `GET /api/listas/:id`, `POST /api/listas/:id/contenidos`, `DELETE .../:cid` | `CrearLista, ObtenerListas, ObtenerListaDetalle, AnadirContenidoALista, QuitarContenidoDeLista` | CRUD listas OK | ✅ Verde |
| **UC4** | `GET /api/usuario-contenido` + `PATCH /api/usuario-contenido/:cid` | `ListarUsuarioContenidos, ActualizarEstado` + `TransicionEstado` (retroceso libre `pendiente|en_proceso|visto`, idempotente) | Doc retroceso libre idempotente — verificado | ✅ Verde |
| **UC5** | `GET /api/contenidos/:id/publico` (SIN auth) + `GET /api/usuarios/buscar?q=` (auth, ILIKE, limit10) + `POST|GET /api/comparticiones` + `PATCH /api/comparticiones/:id` | `ObtenerContenidoPublico, BuscarUsuarios, CompartirContenido (200 reenvío fecha_envio / 201 tras rechazada, 400 auto-compartir), ListarComparticiones, ResponderComparticion (aceptar→aceptada + usuario_contenido pendiente idempotente + yaExistia, rechazar→rechazada, 403, 409)` | **Contrato doc incompleto** (faltan 2 rutas en tablas) pero prosa AGENTS correcta; código verifica `CompartirContenido:45-70` y `ResponderComparticion:34-83` con `{comparticion,yaExistia}` | ✅ Verde (con BUG-01 drift) |
| **UC6** | `GET /api/inicio` | `ObtenerInicio` → `RecomendacionServiceV1` (afinidad tipo ASC determinista + popularidad, excluye todo `usuario_contenido`, fallback populares, limit10) | `enProceso` where `en_proceso` + recomendaciones excluyendo todo — verificado | ✅ Verde |
| **Auth** | `POST /api/auth/register, /api/auth/login` | `RegistrarUsuario, LoginUsuario` (bcryptjs + jwt, `AppError` 401/409) | JWT OK | ✅ Verde |

**Cobertura:** 16 `ƒ Dynamic` en build + 18 use-cases + 5 repos Prisma + 6 infrastructure services — sin rutas huérfanas. `src/app/api/_helpers/auth.ts` único helper no-ruta.

---

## Correcciones aplicadas (PASO 3) — 5 correcciones indicadas

> Aplicadas **sin commit** sobre `AGENTS.md` (fuera de `<!-- BEGIN:nextjs-agent-rules -->`) y `contexto-proyecto-plataforma-contenidos.md`. Diff final entregado para revisión antes de commit.

| # | Fichero | Corrección | Diff resumen |
|---|---------|------------|--------------|
| **1** | `contexto-proyecto:Sec 5` | Volcado literal `prisma/schema.prisma` (Prisma 7: `datasource` sin `url`, `previewFeatures`, `@@id`, `@@unique` parcial) + nota `prisma.config.ts` | `datasource url` → eliminado; `generator` +`previewFeatures`; `@@primaryKey` → `@@id` (2 modelos); añadido `@@unique` parcial |
| **2** | `contexto-proyecto:Sec 4` + `AGENTS.md:48-58` | Contrato ampliado con `GET /api/contenidos/:id/publico (SIN auth)` y `GET /api/usuarios/buscar?q=` (auth, `q≥2`, `ILIKE`, limit10) | +2 líneas en ambos contratos |
| **3** | `contexto-proyecto:Sec 6` | Reescritura completa: tabla UC1-UC6 verde con fecha 2026-09-10, 16 routes/18 use-cases, `npm test 214/1`, `lint 0`, `build OK`, refs `CHANGELOG 0.1.0/0.0.1`, nota migración pendiente BUG-01 | Reemplazo total Sec 6 (290→~310 líneas) |
| **4** | `AGENTS.md:46` | Eliminar frase falsa "Sin prisma/schema.prisma en disco aun" | Línea reemplazada por fuente literal disco + `prisma.config.ts` |
| **5** | `AGENTS.md:45` | Añadir `@@unique` parcial a "claves que rompen" | `Comparticion @@index` → `@@index + @@unique(where:pendiente) (partialIndexes)` |

---

## Recomendación final

1. **Mergear 5 correcciones doc** (diff abajo) — ambas fuentes vuelven a estar sincronizadas con repo real.
2. **Resolver BUG-01** (migración parcial) **antes** de próximo deploy a Neon prod — es el único riesgo de integridad real detectado.
3. Inicializar git (BUG-02) para trazabilidad.

*Auditoría ejecutada 2026-09-10 — validado con `npm test && npm run lint && npm run build` todos en verde; `prisma migrate status` up-to-date con drift pendiente documentado.*
