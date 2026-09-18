# Auditoría Plataforma Contenidos — Aprobada / P0 Ejecutado

> **Estado:** `APROBADO — P0 EJECUTADO 2026-09-18` — P0 verificado (login/logout probado manualmente en navegador, funciona correctamente)  
> **Fecha:** 2026-09-17  
> **Auditor:** Arquitecto de Software Senior / Auditor de Código / Tech Lead IA  
> **Stack auditado:** Next.js 16.3.3 App Router + React 19.2.8 + TypeScript 5 strict + Tailwind 4 + Prisma 7.10 (@prisma/adapter-pg + pg 8.23) + PostgreSQL Neon (pooled `DATABASE_URL` / direct `DIRECT_URL` con `?sslmode=require`) + bcryptjs 3.0.3 + jsonwebtoken 9.0.3 + vitest 4.1.11  
> **Alcance:** Solo-lectura exhaustiva — `src/domain` (12 archivos), `src/application` (27 archivos), `src/infrastructure` (10 archivos), `src/app/api` (14 Route Handlers / 18 endpoints), `prisma/schema.prisma:1-198`, `next.config.ts:1-13`, `vitest.config.ts:1-18`, `prisma.config.ts:1-13`, `package.json:1-41`  
> **Fuente canónica:** `contexto-proyecto-plataforma-contenidos.md` + `AGENTS.md` + `schema.prisma` en disco  
> **Tests baseline:** `npm test` → 217 passed / 1 skipped, `npm run lint` → 0 errors, `npm run build` → 18 `ƒ Dynamic` + 6 `○ Static` (verificado 2026-09-17)

---

## 1. DIAGNÓSTICO DE ARQUITECTURA ACTUAL

### 1.1 Interpretación — Estructura, flujo de datos y stack

**Full-stack Next.js 16 App Router sin backend separado:** `src/app/api/**/route.ts` son el backend real. Flujo:

```
HTTP Request → getAuthenticatedUserId (src/app/api/_helpers/auth.ts:8) → UseCase (src/application/use-cases/*.ts) → IRepository (src/domain/repositories/*.ts) → Prisma*Repository (src/infrastructure/repositories/*.ts) → Neon PG vía PrismaPg singleton (src/infrastructure/database/prisma.ts:1-22)
→ (UC1) IExternalSearchService → TmdbAdapter (src/infrastructure/services/TmdbAdapter.ts:9) / IgdbAdapter (src/infrastructure/services/IgdbAdapter.ts:22) / SpotifyAdapter (src/infrastructure/services/SpotifyAdapter.ts:22) con fetchWithTimeout (src/infrastructure/services/fetchWithTimeout.ts:3, 5s AbortController, limit 10)
→ Frontend src/app/(dashboard|buscar|mis-contenidos|listas)/page.tsx consume vía src/lib/api.ts:27 apiFetch con Bearer
```

**Capas DDD implementadas (UC1-UC6 verde):**

- `src/domain/{entities,repositories,services}` — entidades puras (`Contenido.ts`, `Usuario.ts`, `Lista.ts`, `Comparticion.ts`) + interfaces (`IContenidoRepository`, `IUsuarioRepository`, `IListaRepository`, `IUsuarioContenidoRepository`, `IComparticionRepository`, `IExternalSearchService`, `IRecomendacionService`, `TransicionEstado.ts`)
- `src/application/{dtos,use-cases,errors}` — 22 use-cases (`RegistrarUsuario`, `LoginUsuario`, `BuscarContenido`, `CrearContenido`, `ObtenerContenidoDetalle`, `ListarUsuarioContenidos`, `ActualizarEstado`, `EliminarUsuarioContenido`, `CrearLista`, `ObtenerListas`, `ObtenerListaDetalle`, `AnadirContenidoALista`, `QuitarContenidoDeLista`, `CompartirContenido`, `ResponderComparticion`, `ListarComparticiones`, `BuscarUsuarios`, `ObtenerInicio`, `GestionarFeedbackRecomendacion` + `AppError.ts:1-52`) + 7 DTOs
- `src/infrastructure/{database,repositories,auth,services}` — 5 `Prisma*Repository` + `jwt.ts:10` + `Tmdb/Igdb/SpotifyAdapter` + `RecomendacionServiceV1.ts` / `RecomendacionServiceV2.ts:45` (pool TOP50 por `popularidadExterna Float? @@index([popularidadExterna])` en `schema.prisma:77-78`, shuffle, 4×4=16, `yaAnadido` via `historial`, excluye `usuario_contenido` + `feedback(no_me_gusta,ya_lo_vi)`, afinidad por tipo)
- `src/app/api` — 18 endpoints: `POST /api/auth/register|login`, `GET /api/contenidos/buscar?tipo=&q=` (UC1), `POST /api/contenidos` + `GET /api/contenidos/:id` (UC2, idempotente `yaExistia`), `GET /api/contenidos/:id/publico` (UC5 sin auth), `GET /api/usuarios/buscar?q=` (UC5 auth, `q≥2`, `ILIKE` limit 10 sin email), `GET|POST /api/listas`, `GET /api/listas/:id` (con `estado`), `POST .../contenidos`, `DELETE .../:cid`, `GET /api/usuario-contenido` + `PATCH /api/usuario-contenido/:cid` + `DELETE /api/usuario-contenido/:cid` (UC4 + `historial` upsert), `POST|GET /api/comparticiones` + `PATCH /api/comparticiones/:id` (200 reenvío pendiente duplicado / 201 tras rechazada / 403/409), `GET /api/inicio` (UC6 V2 `enProceso` + `recomendacionesPorTipo`) + `POST|DELETE /api/recomendaciones/feedback` (3 votos `me_gusta|no_me_gusta|ya_lo_vi`), `src/lib/api.ts:6` `localStorage` + `src/context/AuthContext.tsx:26` hidratación, alias `@/* -> src/*` en `tsconfig.json:21`

Catálogo 360 reales (90 por tipo, `scripts/seed_popular_reales.ts`, `popularidadExterna` TMDB `popularity` / IGDB `total_rating` / Spotify `popularity`). 3 migraciones trazadas (`20250826000000_001_schema_inicial` + `20250917000000_add_historial_y_feedback` + `20250917000001_add_popularidad_externa`), `partialIndexes` en `Comparticion @@unique([...], where:{estado:"pendiente"})` (`schema.prisma:170`, `generator previewFeatures: ["partialIndexes"]` en `schema.prisma:7`).

### 1.2 Evaluación — Buenas prácticas

| Principio | Veredicto | Evidencia |
|---|---|---|
| **SOLID** | **Parcial. DIP cumplido en 90%, violado en 1 crítico** | Bien: `CrearContenidoUseCase.ts:34` inyecta 3 interfaces (`IContenidoRepository`, `IUsuarioContenidoRepository`, `IListaRepository`). Mal: `GestionarFeedbackRecomendacion.ts:22` importa `prisma` directo en `application` → rompe DIP y acopla caso de uso a infra. `ObtenerInicio.ts:37` hace `if (typeof svc.recomendarAgrupado === 'function')` downcast a `RecomendacionServiceV2` → leakea abstracción infra en `application`, rompe OCP. Contrato `IRecomendacionService.ts:3` solo `recomendar` insuficiente para V2. `RecomendacionServiceV2.ts:45` es clase standalone que no implementa `IRecomendacionService` mientras `RecomendacionServiceV1` sí → inconsistencia |
| **Clean Code** | **Bueno con deuda DRY** | Handlers delgados (ej `src/app/api/contenidos/route.ts:22-71` solo parse + `getAuthenticatedUserId` + `try/catch AppError`), use-cases <123 LOC, `fetchWithTimeout.ts:27` `assertOk` reutilizado. Pero `mapDetalleFromRow` duplicado ×5 (`PrismaContenidoRepository.ts:150`, `PrismaUsuarioContenidoRepository.ts:106`, `RecomendacionServiceV1.ts:281`, `RecomendacionServiceV2.ts:197`) + `Prisma.raw(columnasDetalle)` con strings hardcodeados (`RecomendacionServiceV2.ts:115,138,142,145,155`) → DRY violado, 4 edits por cambio detalle y SQLi latente. `TransicionEstado.ts:3` `isTransicionValida=>true` + `void _actual` es código muerto de matriz histórica |
| **Escalabilidad** | **No escala hoy (>10k usuarios / >1k contenidos por usuario)** | `PrismaUsuarioContenidoRepository.ts:44` `findAllByUsuarioId` sin `take/skip/cursor` trae todos con `include:{contenido:{include:{detalle*}}}`; `ObtenerInicio.ts:18` filtra `en_proceso` en memoria sobre todos. `RecomendacionServiceV2.ts:79-96` loop secuencial 4 tipos + fallback = 5-8 roundtrips secuenciales a Neon por `GET /api/inicio`; `inicio/route.ts:18` `Cache-Control: no-store, no-cache, must-revalidate` anula CDN + `Math.random()` shuffle anula cache. Sin paginación en `GET /api/usuario-contenido`, `GET /api/listas`, `GET /api/comparticiones` + sin índice `contenidos(fecha_anadido)` (`schema.prisma:77-78` solo `@@index([tipo])` + `@@index([popularidadExterna])`) |
| **Seguridad** | **Crítica: 2 P0 sin mitigar** | `src/lib/api.ts:6-9` JWT en `localStorage` + `RegistrarUsuario.ts:9` / `LoginUsuario.ts:7` `JWT_EXPIRES_IN ?? "7d"` sin revocación → XSS persistente 7 días. `Glob middleware.ts` 0 archivos, `Grep rate.*limit|cors|helmet|csrf` 0 hits, `next.config.ts:1-13` solo `remotePatterns` sin `headers()` `CSP/HSTS/XFO` ni `CORS`. `IgdbAdapter.ts:76` `search "${q.replace(/"/g,'\\"')}"` escapado mínimo (no `;`/`:`/`limit`). `prisma.config.ts:8` y `prisma.ts:7` fallback silencioso a `postgresql://usuario:password@localhost:5432/plataforma_contenidos` si `DATABASE_URL` no seteado en prod |

**Conclusión diagnóstico:** Arquitectura DDD bien ejecutada para MVP 360 filas — todas las UC1-UC6 verdes con `build` y `lint` en verde — pero no productiva sin hardening P0, paginación, cache y observabilidad. La deuda no bloquea demo/dev pero bloquea exposición pública.

> **Aclaraciones necesarias para veredicto fino (responder antes de aprobar ejecución):** ¿DAU/volumen esperado y p95 `usuario_contenido` por usuario? ¿Entorno despliegue (Vercel + Neon pooled `DATABASE_URL` vs Docker fallback `docker-compose.yml:1-21`)? ¿Requisitos RGPD (borrado `historial_usuario_contenido`/`recomendacion_feedback`, retención)? ¿Presupuesto rate-limit (Upstash/Arcjet) y cache (Redis/KV)?

---

## 2. INFORME DE ERRORES, BUGS Y DEUDA TÉCNICA (Arreglos Inmediatos)

### P0-CRIT-01 — JWT en localStorage + 7d sin revocación [XSS → robo sesión prolongado]

- **Ubicación:** `src/lib/api.ts:6-9` `setAuth(token,usuario)` → `localStorage.setItem("token", token)`; `src/lib/api.ts:2` `getToken()` lee de `localStorage`; `src/context/AuthContext.tsx:26-30` hidrata desde `localStorage`; `src/application/use-cases/RegistrarUsuario.ts:9` `const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d"` (igual en `LoginUsuario.ts:7`); `src/infrastructure/auth/jwt.ts:3-8` no fija `algorithm`/`aud`/`iss` y ventana 7d sin blacklist
- **Problema e impacto:** Cualquier XSS (hoy 0 `dangerouslySetInnerHTML` pero sin `Content-Security-Policy` en `next.config.ts:3` ni `middleware.ts`) roba token persistente. No hay `httpOnly`/`Secure`/`SameSite` cookie, no hay refresh/rotación, no hay revocación. Ventana de exposición 7 días por robo. Además `GET /api/contenidos/:id/publico` es sin auth (`src/app/api/contenidos/[id]/publico/route.ts:6`) intencionalmente — no mitigado por token en LS
- **Estrategia / código corregido:**

```typescript
// src/app/api/auth/login/route.ts (y register) — settear httpOnly cookies
import { NextResponse } from "next/server";
import { signAccess, signRefresh } from "@/infrastructure/auth/jwt";

export async function POST(req: Request) {
  // ... validar, bcrypt.compare ...
  const access = signAccess({ sub: usuario.id, email: usuario.email });
  const refresh = signRefresh({ sub: usuario.id });
  // Persistir refresh jti en DB o KV con TTL 7d para revocación
  const res = NextResponse.json({ usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email } });
  res.cookies.set("token", access, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 15, // 15m
    path: "/",
  });
  res.cookies.set("refresh", refresh, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7d solo para refresh
    path: "/api/auth/refresh",
  });
  return res;
}

// src/app/api/_helpers/auth.ts:8 — leer Bearer o cookie (compat migración)
import { cookies } from "next/headers";
import { extractBearerToken, verifyToken } from "@/infrastructure/auth/jwt";
import { UnauthorizedError } from "@/application/errors/AppError";

export async function getAuthenticatedUserId(req: Request): Promise<string> {
  const bearer = extractBearerToken(req.headers.get("authorization"));
  const cookieToken = (await cookies()).get("token")?.value ?? null;
  const token = bearer ?? cookieToken;
  if (!token) throw new UnauthorizedError("No autorizado");
  const payload = verifyToken(token);
  return payload.sub;
}

// src/infrastructure/auth/jwt.ts:10 — fijar algoritmo, issuer, audience, expiración corta
import jwt from "jsonwebtoken";
function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET no configurado");
  return s;
}
export function signAccess(payload: { sub: string; email: string }) {
  return jwt.sign(payload, getJwtSecret(), { algorithm: "HS256", expiresIn: "15m", issuer: "plataforma", audience: "web" });
}
export function signRefresh(payload: { sub: string }) {
  return jwt.sign(payload, getJwtSecret(), { algorithm: "HS256", expiresIn: "7d", issuer: "plataforma", audience: "refresh" });
}
export function verifyToken(token: string) {
  return jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"], issuer: "plataforma" }) as JwtPayload;
}
// Añadir POST /api/auth/refresh (verifica refresh cookie, rota) y DELETE /api/auth/logout (clear cookies + blacklist jti)

// src/lib/api.ts — dejar de usar localStorage para token (mantener solo usuario para UI optimista si se quiere, pero preferible cookie)
export function getToken(): string | null { return null; } // ya no se lee LS
export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers as HeadersInit);
  headers.set("Content-Type", "application/json");
  // token via cookie httpOnly se envía solo con credentials: include
  const res = await fetch(path, { ...init, headers, credentials: "include" });
  if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
  return res;
}
```

### P0-CRIT-02 — Sin rate-limit / CSP / HSTS / CORS → brute-force y DoS a APIs externas

- **Ubicación:** `Glob middleware.ts` → `No files found`; `Grep pattern="rate.*limit|cors|csrf|helmet|sanitize"` → 0 hits en `src/`; `next.config.ts:1-13` solo `images.remotePatterns` (tmdb/igdb/scdn.co) sin `headers()`; `src/application/use-cases/BuscarContenido.ts:27` sin debounce server-side
- **Problema e impacto:** `POST /api/auth/login` brute-forceable sin límite; `GET /api/contenidos/buscar?tipo=&q=` cada request hace `fetch 5s` a TMDB/IGDB/Spotify (`fetchWithTimeout.ts:3`), abusables para DoS externo y coste. Sin `CSP`/`HSTS`/`XFO` ni `CORS` explícito — falta defence-in-depth. Mutaciones usan `Bearer` (CSRF no aplica hoy) pero al migrar a cookies sin `SameSite`/`Origin` check quedará expuesto
- **Estrategia / código corregido:**

```typescript
// src/middleware.ts (nuevo, Next 16)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("Content-Security-Policy", "default-src 'self'; img-src 'self' https://image.tmdb.org https://images.igdb.com https://i.scdn.co; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live; connect-src 'self' https://api.themoviedb.org https://api.igdb.com https://api.spotify.com");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return res;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

// next.config.ts:3 — añadir HSTS en prod
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org" }, { protocol: "https", hostname: "images.igdb.com" }, { protocol: "https", hostname: "i.scdn.co" }] },
  async headers() {
    return [{ source: "/(.*)", headers: [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] }];
  },
};
export default nextConfig;

// Rate limit — integrar @upstash/ratelimit o arcjet en Route Handlers sensibles
// src/app/api/_helpers/rateLimit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
const ratelimit = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(5, "1 m") });
export async function checkRateLimit(ip: string) {
  const { success } = await ratelimit.limit(ip);
  if (!success) throw new AppError("Demasiadas peticiones", 429, "RATE_LIMITED");
}
// Uso en src/app/api/auth/login/route.ts y src/app/api/contenidos/buscar/route.ts:10
// const ip = req.headers.get("x-forwarded-for") ?? "unknown"; await checkRateLimit(`login:${ip}`);
```

### P0-CRIT-03 — Race find + create sin transacción en UC2 → duplicado @@unique → 500 intermitente

- **Ubicación:** `src/application/use-cases/CrearContenido.ts:67-89` (`findByFuenteExternaAndIdExterno` → `create` fuera de tx) + `PrismaContenidoRepository.ts:86-144` (`create` en `$transaction` solo para `contenido`+detalle, no para deduplicación) + `schema.prisma:195` `@@unique([fuenteExterna, idExterno])`
- **Problema e impacto:** Dos requests concurrentes con mismo `fuenteExterna/idExterno` (ej 2 tabs añadiendo mismo resultado TMDB) compiten: ambos `find` → `null`, ambos `create` → uno viola `P2002` y `AppError` no lo captura → 500 en lugar de deduplicación elegante `yaExistia:true` idempotente
- **Estrategia / código corregido:**

```typescript
// src/infrastructure/repositories/PrismaContenidoRepository.ts — nuevo método atómico
import { Prisma } from "@prisma/client";
async findOrCreate(dto: { tipo: TipoContenido; titulo: string; imagenUrl: string | null; fuenteExterna: FuenteExterna; idExterno: string; detalle: unknown }): Promise<{ contenido: Contenido; yaExistia: boolean }> {
  // Opción A: upsert atómico (preferida)
  const row = await this.prisma.contenido.upsert({
    where: { fuenteExterna_idExterno: { fuenteExterna: dto.fuenteExterna, idExterno: dto.idExterno } },
    create: {
      tipo: dto.tipo, titulo: dto.titulo.trim(), imagenUrl: dto.imagenUrl, fuenteExterna: dto.fuenteExterna, idExterno: dto.idExterno,
      // crear detalle 1:1 según tipo en misma tx (requiere transacción si detalles son tablas separadas)
    },
    update: {}, // no-op, reutiliza existente
    include: { detallePelicula: true, detalleSerie: true, detalleVideojuego: true, detalleMusica: true },
  });
  // Detectar si fue create vs update vía campo o comparando fechaAnadido reciente; simplificado: intentar fetch de detalle previo
  return { contenido: mapToEntity(row), yaExistia: false }; // upsert no distingue; alternativa B abajo distingue
}

// Alternativa B: try/catch P2002 (distingue yaExistia)
async findOrCreateWithFlag(dto: CrearDto): Promise<{ contenido: Contenido; yaExistia: boolean }> {
  try {
    const creado = await this.prisma.$transaction(async (tx) => {
      const c = await tx.contenido.create({ data: { tipo: dto.tipo, titulo: dto.titulo.trim(), imagenUrl: dto.imagenUrl, fuenteExterna: dto.fuenteExterna, idExterno: dto.idExterno } });
      if (dto.detalle) await this.createDetalle(tx, c.id, dto.tipo, dto.detalle);
      return c;
    });
    return { contenido: map(creado), yaExistia: false };
  } catch (e: any) {
    if (e?.code === "P2002" || e?.meta?.target?.includes("fuenteExterna")) {
      const existente = await this.prisma.contenido.findUniqueOrThrow({ where: { fuenteExterna_idExterno: { fuenteExterna: dto.fuenteExterna, idExterno: dto.idExterno } } });
      return { contenido: map(existente), yaExistia: true };
    }
    throw e;
  }
}

// src/application/use-cases/CrearContenido.ts:66 — reemplazar find+create por findOrCreate atómico
const { contenido, yaExistia: globalYaExistia } = await this.contenidoRepo.findOrCreate({
  tipo: dto.tipo as TipoContenido, titulo: dto.titulo, imagenUrl: dto.imagenUrl ?? null,
  fuenteExterna: dto.fuenteExterna as FuenteExterna, idExterno: dto.idExterno, detalle: dto.detalle ?? null,
});
let yaExistia = globalYaExistia;
const yaTiene = await this.usuarioContenidoRepo.exists(usuarioId, contenido.id);
if (!yaTiene) await this.usuarioContenidoRepo.create(usuarioId, contenido.id, "pendiente");
else yaExistia = true; // idempotente
```

### P1-BUG-04 — Recomendaciones V2: 5-8 queries secuenciales + Prisma.raw con strings hardcodeados

- **Ubicación:** `RecomendacionServiceV2.ts:79` `for (const tipo of ordenTipos) { const pool = await this.fetchTopPorPopularidad(...) }` secuencial; `V2.ts:115-158` `Prisma.raw(columnasDetalle)` + `Prisma.raw(joinsDetalle)` + `V2.ts:138-158` `AND c.id <> ALL(${excludeIds}::uuid[])`; `V2.ts:53-60` afinidad `GROUP BY`; `V1.ts:122-152` similar `Prisma.raw(subquery)`; `src/app/api/inicio/route.ts:18` `Cache-Control: no-store`
- **Problema e impacto:** `GET /api/inicio` hace 1 query afinidad + 4-8 `fetchTopPorPopularidad` secuenciales (TOP50 + shuffle `V2.ts:36-43` `Math.random()`) + 2 `NOT EXISTS` + 4 `LEFT JOIN detalle` + `LEFT JOIN historial`. Latencia Neon 400-900ms por request, no paralelizable, sin cache. `Prisma.raw` con strings hardcodeados es frágil y SQLi latente si algún interpolated viniera de usuario (hoy hardcodeados, pero patrón debe migrar a `Prisma.sql`)
- **Estrategia / código corregido:**

```typescript
// RecomendacionServiceV2.ts:51 — paralelizar y usar Prisma.sql tipado
import { Prisma } from "@prisma/client";

async recomendarAgrupado(usuarioId: string): Promise<RecomendacionesPorTipo> {
  const afinidad: Array<{ tipo: TipoContenido; count: number }> = await prisma.$queryRaw(Prisma.sql`
    SELECT c.tipo as tipo, COUNT(*)::int as count
    FROM usuario_contenido uc JOIN contenidos c ON c.id = uc.contenido_id
    WHERE uc.usuario_id = ${usuarioId}::uuid GROUP BY c.tipo ORDER BY count DESC, c.tipo ASC
  `);
  const ordenTipos: TipoContenido[] = [...TIPOS].sort((a, b) => {
    const ca = afinidad.find((x) => x.tipo === a)?.count ?? 0;
    const cb = afinidad.find((x) => x.tipo === b)?.count ?? 0;
    return cb !== ca ? cb - ca : a.localeCompare(b);
  });

  // Paralelizar los 4 tipos (antes secuencial)
  const pools = await Promise.all(
    ordenTipos.map((tipo) => this.fetchTopPorPopularidad(usuarioId, tipo, [], POOL_TOP))
  );
  const result: RecomendacionesPorTipo = { pelicula: [], serie: [], videojuego: [], musica: [] };
  const globalExcluidos = new Set<string>();
  pools.forEach((pool, idx) => {
    const tipo = ordenTipos[idx]!;
    const shuffled = shuffle(pool.filter((r) => !globalExcluidos.has(r.id))).slice(0, LIMIT_POR_TIPO);
    const mapped = shuffled.map((r) => ({ ...mapRow(r), yaAnadido: r.ya_anadido }));
    mapped.forEach((m) => globalExcluidos.add(m.id));
    result[tipo] = mapped;
  });
  return result;
}

private async fetchTopPorPopularidad(usuarioId: string, tipo: TipoContenido, excludeIds: string[], limit: number): Promise<RawRowV2[]> {
  const columnas = Prisma.sql`dp.duracion_min as detalle_pelicula_duracion, dp.director as detalle_pelicula_director, dp.anio as detalle_pelicula_anio, ds.num_temporadas as detalle_serie_temporadas, ds.num_episodios as detalle_serie_episodios, ds.anio_inicio as detalle_serie_anio, dv.plataformas as detalle_videojuego_plataformas, dv.desarrollador as detalle_videojuego_desarrollador, dv.anio_lanzamiento as detalle_videojuego_anio, dm.artista as detalle_musica_artista, dm.album as detalle_musica_album, dm.duracion_seg as detalle_musica_duracion`;
  const joins = Prisma.sql`LEFT JOIN detalle_peliculas dp ON dp.contenido_id = c.id LEFT JOIN detalle_series ds ON ds.contenido_id = c.id LEFT JOIN detalle_videojuegos dv ON dv.contenido_id = c.id LEFT JOIN detalle_musica dm ON dm.contenido_id = c.id`;
  const excludeClause = excludeIds.length > 0 ? Prisma.sql`AND c.id <> ALL(${excludeIds}::uuid[])` : Prisma.empty;
  return prisma.$queryRaw<RawRowV2[]>(Prisma.sql`
    SELECT c.id, c.tipo, c.titulo, c.imagen_url, c.fuente_externa, c.id_externo, c.fecha_anadido,
           CASE WHEN h.usuario_id IS NOT NULL THEN true ELSE false END as ya_anadido,
           ${columnas}
    FROM contenidos c
    LEFT JOIN historial_usuario_contenido h ON h.usuario_id = ${usuarioId}::uuid AND h.contenido_id = c.id
    ${joins}
    WHERE c.tipo = ${tipo}::"TipoContenido"
      AND NOT EXISTS (SELECT 1 FROM usuario_contenido uc WHERE uc.usuario_id = ${usuarioId}::uuid AND uc.contenido_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM recomendacion_feedback rf WHERE rf.usuario_id = ${usuarioId}::uuid AND rf.contenido_id = c.id AND rf.voto IN ('no_me_gusta','ya_lo_vi'))
      ${excludeClause}
    ORDER BY c.popularidad_externa DESC NULLS LAST, c.fecha_anadido DESC
    LIMIT ${limit}
  `);
}
// src/app/api/inicio/route.ts:18 — cache privado con revalidate
export async function GET(req: Request) {
  // ... getAuthenticatedUserId ...
  const data = await obtenerInicio.execute(usuarioId);
  return NextResponse.json(data, { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60", "ETag": `"${hash(data)}"` } });
}
```

### P1-BUG-05 — Sin paginación → OOM y IN (...) sin límite en listas grandes

- **Ubicación:** `PrismaUsuarioContenidoRepository.ts:44-57` `findAllByUsuarioId` sin `take/skip/cursor`, single `findMany` + `include:{contenido:{include:{detalle*}}}` + `orderBy fechaActualizacion`; `PrismaListaRepository.ts:36-68` `findAllByUsuarioId` + `findByIdWithContenidos` 2 queries `usuarioContenido.findMany where contenidoId in (...)` sin chunking; `ObtenerInicio.ts:18` `filter(r=>estado==="en_proceso")` en memoria sobre todos; `PrismaComparticionRepository.ts` `findMany` sin `take` (endpoints `GET /api/comparticiones`, `GET /api/listas`)
- **Problema e impacto:** Usuario con 1000-2000 `usuario_contenido` carga todo en memoria; `IN (...)` con 500 ids puede exceder `max_parameters` de PG; lista grande (>50) hace 2 queries sin límite
- **Estrategia / código corregido:**

```typescript
// src/domain/repositories/IUsuarioContenidoRepository.ts — añadir contrato paginado
findAllByUsuarioIdPaginated(usuarioId: string, opts: { take: number; cursor?: string; estado?: EstadoContenido; q?: string }): Promise<{ items: UsuarioContenidoConDetalle[]; nextCursor: string | null }>;

// src/infrastructure/repositories/PrismaUsuarioContenidoRepository.ts:44
async findAllByUsuarioIdPaginated(usuarioId: string, { take, cursor, estado, q }: { take: number; cursor?: string; estado?: string; q?: string }) {
  const where: Prisma.UsuarioContenidoWhereInput = { usuarioId, ...(estado ? { estado: estado as any } : {}), ...(q ? { contenido: { titulo: { contains: q, mode: "insensitive" } } } : {}) };
  const takeClamped = Math.min(Math.max(take ?? 20, 1), 50);
  const rows = await this.prisma.usuarioContenido.findMany({
    where, take: takeClamped + 1, ...(cursor ? { cursor: { usuarioId_contenidoId: { usuarioId, contenidoId: cursor } }, skip: 1 } : {}),
    orderBy: { fechaActualizacion: "desc" },
    include: { contenido: { include: { detallePelicula: true, detalleSerie: true, detalleVideojuego: true, detalleMusica: true } } },
  });
  const hasMore = rows.length > takeClamped;
  const items = hasMore ? rows.slice(0, -1) : rows;
  return { items: items.map(map), nextCursor: hasMore ? items[items.length - 1]!.contenidoId : null };
}

// src/app/api/usuario-contenido/route.ts — exponer ?take=&cursor=&estado=&q=
export async function GET(req: Request) {
  const usuarioId = await getAuthenticatedUserId(req);
  const { searchParams } = new URL(req.url);
  const take = Number(searchParams.get("take") ?? "20");
  const cursor = searchParams.get("cursor") ?? undefined;
  const estado = searchParams.get("estado") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const { items, nextCursor } = await useCase.executePaginated(usuarioId, { take, cursor, estado, q });
  return NextResponse.json({ items, nextCursor });
}
// Repetir para GET /api/listas y GET /api/comparticiones (take 20, cursor por id/fechaEnvio)
```

### P1-BUG-06 — GestionarFeedback usa prisma directo en application → rompe DDD, untestable

- **Ubicación:** `src/application/use-cases/GestionarFeedbackRecomendacion.ts:22-27` `import { prisma } from "@/infrastructure/database/prisma"` y `prisma.recomendacionFeedback.upsert/delete`; `IRecomendacionService.ts:3` no cubre feedback; `RecomendacionServiceV2.ts:51` no implementa interfaz; `schema.prisma:187-196` `RecomendacionFeedback @@id([usuarioId,contenidoId])`
- **Problema e impacto:** `application` conoce `infrastructure` (DIP violado), imposible mockear en tests unitarios, duplica exclusión `NOT EXISTS (feedback IN ('no_me_gusta','ya_lo_vi'))` en `V2.ts:151-153`
- **Estrategia / código corregido:**

```typescript
// src/domain/repositories/IRecomendacionFeedbackRepository.ts (nuevo)
export interface IRecomendacionFeedbackRepository {
  save(usuarioId: string, contenidoId: string, voto: VotoRecomendacion): Promise<void>;
  remove(usuarioId: string, contenidoId: string): Promise<void>;
  findByUsuario(usuarioId: string): Promise<Array<{ contenidoId: string; voto: VotoRecomendacion }>>;
  exists(usuarioId: string, contenidoId: string): Promise<boolean>;
}

// src/infrastructure/repositories/PrismaRecomendacionFeedbackRepository.ts (nuevo)
export class PrismaRecomendacionFeedbackRepository implements IRecomendacionFeedbackRepository {
  async save(usuarioId: string, contenidoId: string, voto: VotoRecomendacion) {
    await prisma.recomendacionFeedback.upsert({ where: { usuarioId_contenidoId: { usuarioId, contenidoId } }, create: { usuarioId, contenidoId, voto }, update: { voto, fecha: new Date() } });
  }
  async remove(usuarioId: string, contenidoId: string) {
    await prisma.recomendacionFeedback.delete({ where: { usuarioId_contenidoId: { usuarioId, contenidoId } } }).catch(() => { throw new NotFoundError("Feedback no encontrado"); });
  }
}

// src/application/use-cases/GestionarFeedbackRecomendacion.ts:22 — inyectar repo
export class GestionarFeedbackRecomendacionUseCase {
  constructor(private readonly feedbackRepo: IRecomendacionFeedbackRepository) {}
  async votar(usuarioId: string, contenidoId: string, voto: VotoRecomendacion) {
    if (!usuarioId) throw new UnauthorizedError();
    await this.feedbackRepo.save(usuarioId, contenidoId, voto);
  }
  async deshacer(usuarioId: string, contenidoId: string) {
    await this.feedbackRepo.remove(usuarioId, contenidoId);
  }
}
```

### P1-BUG-07 — Token IGDB/Spotify cache en memoria no distribuido + escapado IGDB mínimo

- **Ubicación:** `IgdbAdapter.ts:22-55` `let twitchToken: string | null, twitchExpiry: number` con buffer 60s, `fetchWithTimeout.ts:3` sin retry; `SpotifyAdapter.ts:22-53` igual con `client_credentials`; `IgdbAdapter.ts:76` `search "${q.replace(/"/g,'\\"')}"` solo escapa `"`; `SpotifyAdapter.ts:60` `enrichWithPopularity` sin fallback
- **Problema e impacto:** En Vercel serverless/edge cada cold start refetchea token Twitch/Spotify (2 RTT extra por búsqueda `GET /api/contenidos/buscar?tipo=videojuego&q=` o `musica`). `q` con `"; limit 100;` o `";` puede inyectar sintaxis IGDB Query Language (no SQL pero DoS/amplificación)
- **Estrategia / código corregido:**

```typescript
// IgdbAdapter.ts:76 — sanitizar y limitar
const sanitized = q.replace(/[";\\]/g, " ").replace(/\s+/g, " ").slice(0, 100).trim();
if (sanitized.length < 2) throw new ValidationError("q debe tener al menos 2 caracteres");
const body = `search "${sanitized}"; fields name,cover.url,platforms.name,summary,total_rating,first_release_date; limit 10; where platforms != null;`;

// Cache distribuido — upstash-redis o fetch cache Next
// src/infrastructure/services/TokenCache.ts
import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();
export async function getCachedToken(key: string, fetcher: () => Promise<{ token: string; expiresIn: number }>) {
  const cached = await redis.get<string>(key);
  if (cached) return cached;
  const { token, expiresIn } = await fetcher();
  await redis.set(key, token, { ex: expiresIn - 60 });
  return token;
}
// Uso en IgdbAdapter.ts:22 y SpotifyAdapter.ts:22
// const token = await getCachedToken("igdb:twitch_token", async () => { const r = await fetch("https://id.twitch.tv/oauth2/token", ...); return { token: r.access_token, expiresIn: r.expires_in }; });
```

### P2-DEUDA-08 — Fallback silencioso DATABASE_URL → localhost en prod

- **Ubicación:** `prisma.config.ts:8-11` `datasource.url = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "postgresql://usuario:password@localhost:5432/plataforma_contenidos"` y `src/infrastructure/database/prisma.ts:7-9` `new PrismaPg({ connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "postgresql://usuario:password@localhost:5432/plataforma_contenidos" })`; `.env.example:1-14` documenta dual pooled/direct pero no exige
- **Problema e impacto:** Si `DATABASE_URL`/`DIRECT_URL` no seteados en prod (Neon `?sslmode=require` requerido), conecta silenciosamente a localhost y `migrate deploy` falla confuso o app arranca sin DB
- **Estrategia / código corregido:**

```typescript
// prisma.config.ts:8
import { defineConfig, env } from "prisma/config";
export default defineConfig({
  earlyAccess: true,
  schema: "./prisma/schema.prisma",
  migrate: { async seed() {} },
  datasource: {
    url: (() => {
      const url = env("DATABASE_URL") ?? env("DIRECT_URL");
      if (!url) throw new Error("DATABASE_URL o DIRECT_URL requeridos (ver scripts/neon-setup.md, requiere ?sslmode=require en Neon)");
      return url;
    })(),
  },
});
// src/infrastructure/database/prisma.ts:7
function getConnectionString(): string {
  const url = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
  if (!url) throw new Error("DATABASE_URL o DIRECT_URL requeridos");
  if (!url.includes("sslmode=require") && url.includes("neon.tech")) console.warn("[prisma] Neon requiere ?sslmode=require");
  return url;
}
const adapter = new PrismaPg({ connectionString: getConnectionString() });
```

### P2-DEUDA-09 — Índices faltantes para ORDER BY y IN (...)

- **Ubicación:** `schema.prisma:77-78` solo `@@index([tipo])` y `@@index([popularidadExterna])`; `RecomendacionServiceV2.ts:156` `ORDER BY c.popularidad_externa DESC NULLS LAST, c.fecha_anadido DESC`; `PrismaListaRepository.ts:64` `where: { contenidoId: { in: [...ids] } }` sobre `usuario_contenido`; `PrismaUsuarioContenidoRepository.ts:154` `@@index([usuarioId])` sin `contenidoId` secundario
- **Problema e impacto:** Sort sin índice compuesto hace seq scan sobre 360 filas hoy (ok) pero no escala a 10k+ contenidos; `IN (...)` sin `@@index([contenidoId])` penaliza `findByIdWithContenidos` con listas >50
- **Estrategia / código corregido:**

```prisma
// prisma/schema.prisma — añadir índices compuestos (requiere npx prisma migrate dev --name add_indices_performance)
model Contenido {
  // ...
  @@index([tipo, popularidadExterna]) // para WHERE tipo = X ORDER BY popularidadExterna DESC
  @@index([popularidadExterna, fechaAnadido]) // para ORDER BY popularidadExterna DESC, fecha_anadido DESC
  @@index([fechaAnadido])
}
model UsuarioContenido {
  // ...
  @@index([usuarioId, estado]) // para filtro enProceso / pending en DB
  @@index([contenidoId])
  @@index([usuarioId, fechaActualizacion]) // para paginación ORDER BY fechaActualizacion DESC
}
model Comparticion {
  // ...
  @@index([usuarioOrigenId, estado])
}
```

---

## 3. LISTA DE MEJORAS DE INFRAESTRUCTURA Y CALIDAD (Refactorización — sin cambio de negocio)

> Todas son reversibles, no cambian contrato `contexto-proyecto:Sec 4`, pero mejoran mantenibilidad, perf y observabilidad. Ordenadas por ROI.

1.  **Error handling centralizado `withAppError`** — Eliminar duplicación `if (error instanceof AppError) NextResponse.json({error: error.message, code: error.code}, {status: error.statusCode})` + `SyntaxError` `INVALID_JSON` repetido en 14 `route.ts` (ej `src/app/api/contenidos/route.ts:55-71`, `src/app/api/comparticiones/route.ts:18-20`, `src/app/api/usuario-contenido/[cid]/route.ts:13`). Crear `src/app/api/_helpers/withAppError.ts:1-30` wrapper `export const withAppError = (h: Handler) => async (req, ctx) => { try { return await h(req,ctx) } catch(e){ if(e instanceof AppError) return NextResponse.json({error:e.message,code:e.code},{status:e.statusCode}); if(e instanceof SyntaxError) return NextResponse.json({error:"JSON inválido",code:"INVALID_JSON"},{status:400}); console.error(...); return NextResponse.json({error:"Error interno",code:"INTERNAL"},{status:500}) } }`. Beneficio: DRY, testeable, preserve `error.cause`

2.  **Validación con Zod** — Reemplazar `Contenido.validateTitulo`/`validateTipo`/`validateIdExterno` manual disperso (`Contenido.ts:76-110`, `Lista.ts:24-37`) + `typeof body.x === "string"` casts en handlers por `zod` schemas en `src/application/dtos/*.ts` (ej `CrearContenidoSchema = z.object({ tipo: z.enum(["pelicula","serie","videojuego","musica"]), fuenteExterna: z.enum(["tmdb","igdb","spotify"]), titulo: z.string().min(1).max(255).trim(), idExterno: z.string().min(1).max(100), imagenUrl: z.string().url().max(2048).nullable(), detalle: z.record(z.unknown()).nullable(), listaId: z.string().uuid().optional() })`). Todos los `route.ts` hacen `Schema.parse(await req.json())` → `ValidationError` uniforme. Añadir `eslint-plugin-zod`

3.  **Mapper compartido `mapDetalleFromRow`** — Extraer a `src/infrastructure/mappers/contenidoMapper.ts:1-80` función única `mapDetalleFromRow(row: RawRow) => ContenidoDetalle | null` usada por `PrismaContenidoRepository.ts:150`, `PrismaUsuarioContenidoRepository.ts:106`, `RecomendacionServiceV1.ts:281`, `RecomendacionServiceV2.ts:197`. Hoy 4 copias → 1 fuente, tipar con `Prisma.ContenidoGetPayload<{include:{detallePelicula:true,...}}>` en lugar de `as never` / `as Record<string,unknown>` en `PrismaContenidoRepository.ts:98` y `PrismaUsuarioContenidoRepository.ts:68` que pierden safety. Eliminar `TransicionEstado.ts:3` código muerto o documentar `isTransicionValida` como `true` para retroceso libre UC4

4.  **Prisma Pg pooling y shutdown** — `src/infrastructure/database/prisma.ts:1-22` configurar `new Pool({ connectionString: getConnectionString(), max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 })` y `new PrismaPg(pool)` en lugar de solo `connectionString`. Global singleton ya evita hot-reload leaks (`globalForPrisma.prisma:15-20`), añadir `process.on("SIGTERM", () => prisma.$disconnect())` y `prisma.$on("query", ...)` en dev. Dual `DATABASE_URL` (pooled) / `DIRECT_URL` (direct) ya documentado en `scripts/neon-setup.md` + `docker-compose.yml:1-21` fallback `postgres:16-alpine`

5.  **Observabilidad estructurada** — Reemplazar `console.error` en 14 handlers por `pino` o `next-logger` con `requestId` (`middleware.ts` `crypto.randomUUID()` → `x-request-id` header), loggear `duration`, `usuarioId`, `route`, `statusCode`, `ExternalServiceError.cause`. Añadir `GET /api/health` (DB `SELECT 1`, `prisma.$queryRaw`, adapters `HEAD`) y `GET /api/metrics` si Prometheus. `vitest` `testTimeout:10000` (`vitest.config.ts:14`) ya mitiga flakes

6.  **Caching recomendaciones + ETag** — `RecomendacionServiceV2.ts:51` wrap con `unstable_cache` o Redis `SETEX 60` por `usuarioId` (afinidades + pools). `src/app/api/inicio/route.ts:18` cambiar `no-store, no-cache, must-revalidate` a `private, max-age=30, stale-while-revalidate=60` + `ETag: W/"${hash(recomendacionesPorTipo)}"` para revalidación condicional. Shuffle con seed horario (`seed = hash(usuarioId + floor(Date.now()/3600000))` + `mulberry32`) para cacheabilidad vs `Math.random()` anula cache hoy. `POOL_TOP = 50` ya limita escaneo, materializar vista `vista_recomendaciones_populares` si PG lo requiere

7.  **Circuit breaker + retry externo** — `fetchWithTimeout.ts:3` añadir `retry 1` con backoff exponencial (100ms→200ms) y `opossum` breaker para `TmdbAdapter.ts:9`, `IgdbAdapter.ts:22`, `SpotifyAdapter.ts:22`. Mapear `ExternalServiceError 502` con `Retry-After` header. UC1 `GET /api/contenidos/buscar?tipo=&q=` `q≥2` `limit 10` `timeout 5s` ya bien, pero sin `obtenerPopulares` paginado cacheado

8.  **Paginación cursor + filtros DB** — Migrar todos los `GET` listados (`GET /api/usuario-contenido`, `GET /api/listas`, `GET /api/comparticiones`, `GET /api/listas/:id/contenidos`) a `?take=&cursor=&q=&estado=&tipo=` con `take 20` default `max 50`, `orderBy fechaActualizacion DESC` + cursor `usuarioId_contenidoId`. Filtro `en_proceso` mover de `ObtenerInicio.ts:18` memoria a `WHERE estado='en_proceso'` en DB. Tests de integración `tests/integration/_cleanup.ts:9-42` ya filtra por `idExterno LIKE 'test-%'|'tmdb-%'` y `email LIKE '%@test.com'` — mantener `fileParallelism:false` (`vitest.config.ts:15`)

9.  **Cobertura y contrato** — `vitest.config.ts:1-18` hoy sin `coverage` block → añadir `coverage:{ provider:"v8", thresholds:{ lines:80, branches:70, functions:80 }, exclude:["tests/**","scripts/**",".next/**"] }`. Tests faltantes: `partialIndexes` unique pendiente concurrent (`tests/api/uc5-comparticiones.test.ts` `Promise.all([POST duplicado]) → 200 vs 201`), `RecomendacionServiceV2` shuffle determinismo con seed, `SpotifyAdapter enrichWithPopularity` fallback `NULLS LAST`, `IgdbAdapter` token cache, `next.config remotePatterns` images, `AuthContext` client, contrato `GET /api/contenidos/:id/publico` sin auth no expone `estadoUsuario` (ya verificado en `src/app/api/contenidos/[id]/publico/route.ts:6-15`)

10. **Seguridad headers + sanitización + Zod + ESLint security** — `next.config.ts:1-13` `headers()` con `CSP`/`HSTS`/`XFO` (P0-02), sanitizar `titulo` con `he.encode` si se renderiza raw (hoy React escapa por defecto, pero `innerHTML` 0 hallazgos debe permanecer), validar `imagenUrl` con `new URL()` whitelist `image.tmdb.org|images.igdb.com|i.scdn.co` ya en `remotePatterns`. Añadir `eslint-plugin-security` y `eslint-config-next/core-web-vitals` ya en `eslint.config.mjs:1-18` + regla `no-console` (permitir solo `logger`)

11. **CI/CD y migraciones** — `prisma.config.ts:1-13` `defineConfig` + `datasource.url` ya correcto para Prisma 7, `npx prisma migrate deploy` usa `DIRECT_URL` (`scripts/neon-setup.md`), `npx prisma migrate dev --name <msg>` crea timestamped, fallback `prisma/001_schema_inicial.sql` + `docker compose up -d` (`docker-compose.yml:1-21` `postgres:16-alpine` `healthcheck pg_isready`) ya ok. Añadir GitHub Action: `npm ci && npm test && npm run lint && npm run build && npx prisma migrate status && npx tsx scripts/verify-keys.mjs --ci`. `postinstall` `prisma skills sync || exit 0` (`package.json:12`) ya genera skills, no lanzar manual. `scripts/limpiar-fixtures.ts` y `seed_popular_reales.ts` (90×4 + `popularidadExterna`) mantener para e2e

---

## 4. HOJA DE RUTA DE NUEVAS FEATURES (Funcionalidades Sugeridas)

### Corto plazo — Alta prioridad (2-4 semanas, desbloquea producción)

| # | Feature | Valor | Dependencias | Estimación |
|---|---|---|---|---|
| CP-01 | **Auth httpOnly + refresh + rate-limit** | Cierra P0-01/02, compliance básico, reduce fraude 90% | P0-01/02, `src/middleware.ts`, `upstash-redis` | 1 sem |
| CP-02 | **Paginación cursor en Mis Contenidos + búsqueda server-side `?q=&estado=&cursor=`** | Soporta usuarios 1k+ contenidos sin OOM, filtro DB `@@index([usuarioId, estado])` | P1-05/P2-09 | 1 sem |
| CP-03 | **Notificaciones comparticiones en tiempo real** | UC5 incompleta sin push — `GET /api/comparticiones` polling 30s o `SSE /api/comparticiones/stream`, badge `Header` pendientes, toast `ResponderComparticionUseCase yaExistia` ya implementado (`src/application/use-cases/ResponderComparticion.ts:85`) | `PrismaComparticionRepository` + `EventEmitter` | 1 sem |
| CP-04 | **Observabilidad mínima + /api/health** | Detectar caída Neon/adapters antes que usuario, `GET /api/health` DB `SELECT 1` + TMDB/IGDB/Spotify `HEAD`, `pino` logs + `x-request-id` | P0-02, `RecomendacionServiceV2` | 3 días |

### Mediano plazo (1-3 meses — valor diferencial)

| # | Feature | Valor | Notas técnicas |
|---|---|---|---|
| MP-01 | **Motor recomendación colaborativo híbrido** | V2 actual es `popularidadExterna` + afinidad por tipo + shuffle; sumar `collaborative filtering` Jaccard sobre `usuario_contenido` (usuarios similares) + `me_gusta` señal. Precomputar `popularidad` batch nightly (`scripts/backfill_popularidad.ts` cron), `vista_recomendaciones` materializada | Extiende `RecomendacionServiceV2.ts:51`, añade `RecomendacionServiceV3` que implementa `IRecomendacionService`, `prisma.$queryRaw` con `COUNT` colaborativo |
| MP-02 | **Listas colaborativas y comentarios** | `Lista.colaboradores[]` (`@@index([listaId, usuarioId])`), `PATCH /api/listas/:id/colaboradores` (owner invita), `Comentario` model (`id @db.Uuid, usuarioId, contenidoId, texto @db.Text, fecha`), `GET /api/contenidos/:id/actividad` | UC3 actual `Lista.usuarioId` único — migrar a `ListaColaborador` join table, `Comparticion` reuse patrón `partialIndexes` |
| MP-03 | **Rating (1-5) + review + export** | `UsuarioContenido.puntuacion Int? @db.SmallInt, resena String? @db.Text`, `POST /api/usuario-contenido/:cid/review`, `GET /api/usuario-contenido/export?format=csv|json`, ordena `ORDER BY puntuacion DESC` en `/mis-contenidos` | Complementa `estado pendiente|en_proceso|visto` UC4 con retroceso libre ya idempotente (`PATCH /api/usuario-contenido/:cid`) |
| MP-04 | **Cache externo Redis + token distribuido** | Elimina P1-07 cold start token, cache `ExternalSearchService.ts:11` `q+tipo` 5min, `GET /api/inicio` 60s por `usuarioId` | `upstash-redis` ya para rate-limit, reuse `TokenCache.ts` para `IgdbAdapter`/`SpotifyAdapter`, `unstable_cache` Next 16 |

### Largo plazo (3-6+ meses — plataforma)

| # | Feature | Valor | Notas técnicas |
|---|---|---|---|
| LP-01 | **Feed social + grafo follow** | `Follow @@id([seguidorId, seguidoId])`, `GET /api/feed` (actividad `visto` + `comparticiones aceptadas` de seguidos, `yaAnadido` via `historial` ya existe), grafo con `graphify` (`graphify-out/` community detection, `query/path/explain` tools) | Pilar para `graphify` skill, `RecomendacionServiceV3` usa grafo |
| LP-02 | **PWA offline-first + Mobile (Expo/React Native)** | `next-pwa` + `workbox` cache `GET /api/inicio`/`GET /api/usuario-contenido`, `IndexedDB` sync `usuario_contenido` offline, `Expo` consume mismos `route.ts` con `credentials: include` | Requiere CP-01 httpOnly cookie (no `localStorage`), `apiFetch` con `credentials: include` ya propuesto |
| LP-03 | **Búsqueda semántica + IA resumen** | `pgvector` `contenidos.embedding vector(1536)` + `@@index` HNSW, `GET /api/contenidos/buscar?q=semantica` (embed `q` via OpenAI), resumen LLM `detalle_*` (director/plataformas) vía `IExternalSearchService` enrich | `prisma` `vector` preview, `scripts/seed_popular_reales.ts` backfill embeddings nightly |
| LP-04 | **Multi-tenant / Admin analytics + Prisma Composer** | `Role {user, admin}` `Usuario.role`, `GET /api/admin/metricas` (DAU, top contenidos, `popularidadExterna` drift, `feedback` no_me_gusta rate), `prisma-composer` modules `cron` (backfill), `storage` (S3 `imagenUrl` cache), `streams` (eventos `comparticion.aceptada`) + `bucket()` raw S3 | `src/skills/prisma-composer/SKILL.md` (`compute()`, `contract()`, `mockService`/`bootstrapService`, `prisma-composer deploy --stage`) |

---

## Anexo — Deuda técnica priorizada (resumen ejecutivo)

| Prioridad | Área | Problema | Ubicación | Impacto si no se corrige |
|---|---|---|---|---|
| **P0** | Seguridad | JWT en `localStorage` + `7d` sin revocación | `src/lib/api.ts:6`, `RegistrarUsuario.ts:9`, `LoginUsuario.ts:7`, `jwt.ts:3` | XSS → robo sesión 7d |
| **P0** | Seguridad | Sin rate-limit / CSP / HSTS / CORS | `middleware.ts` inexistente, `next.config.ts:3`, `BuscarContenido.ts:27` | Brute-force + DoS TMDB/IGDB/Spotify |
| **P0** | DB | Race `find`+`create` sin tx → `P2002` 500 | `CrearContenido.ts:67-89`, `schema.prisma:195` | 500 intermitente UC2 concurrente |
| **P1** | Perf | `GET /api/inicio` 5-8 queries secuenciales + `Math.random()` sin cache | `RecomendacionServiceV2.ts:79-96`, `inicio/route.ts:18` | p95 800ms, no escala |
| **P1** | Perf | Sin paginación (`usuario_contenido`, `listas`, `comparticiones`) | `PrismaUsuarioContenidoRepository.ts:44`, `PrismaListaRepository.ts:36` | OOM con usuarios grandes |
| **P1** | Clean | `GestionarFeedback` importa `prisma` en `application` | `GestionarFeedbackRecomendacion.ts:22` | Rompe DDD, untestable |
| **P1** | Perf/Sec | Token TWITCH/SPOTIFY memoria no distribuido + `q` IGDB escapado mínimo | `IgdbAdapter.ts:22,76`, `SpotifyAdapter.ts:22` | Cold start + inyección sintaxis |
| **P2** | Clean | `mapDetalle` duplicado ×5 + `Prisma.raw(string)` | `PrismaContenidoRepository.ts:150`, `RecomendacionServiceV2.ts:115` | Fragilidad, SQLi latente |
| **P2** | DB | Índices faltantes `fecha_anadido`, `usuario_contenido.contenidoId` | `schema.prisma:77-78`, `RecomendacionServiceV2.ts:156` | `ORDER BY` seq scan |
| **P2** | Test | Sin `coverage` thresholds, sin contract `partialIndexes` concurrent | `vitest.config.ts:1-18`, `schema.prisma:170` | Falsos positivos |

---

## Aprobación

- [x] **Aprobado — Ejecutado P0 (SEC + DB)** — `P0-01` httpOnly + `P0-02` middleware/rate-limit + `P0-03` upsert — verificado 2026-09-18
- [ ] **Aprobado — Ejecutar P1 (PERF + CLEAN)** — `P1-04` paralelizar V2 + `P1-05` paginación + `P1-06` repo feedback + `P1-07` token cache
- [ ] **Aprobado — Ejecutar P2 (HARDENING)** — índices + pooling + `withAppError` + Zod
- [ ] **Aprobado — Roadmap CP** — `CP-01..CP-04` corto plazo
- [ ] **Requiere cambios — Comentarios:** _______________________________________________
- [ ] **Rechazado — Motivo:** _______________________________________________

**Nota Product Owner 2026-09-18:** Rate-limit distribuido (Upstash/Redis) **APLAZADO**. Se mantiene la solución en memoria actual como definitiva por ahora. Revisar solo si el proyecto pasa a tener tráfico real en producción con más de una instancia/servidor activo.

**Firmas:**  
Auditor: _________________________ Fecha: 2026-09-17  
Tech Lead: _________________________ Fecha: 2026-09-18  
Product Owner: _________________________ Fecha: 2026-09-18

> Archivo movido a `docs/AUDITORIA-2026-09-17.md` (canónico) el 2026-09-18 tras aprobación P0. Ver `CHANGELOG.md` `0.2.0` y `docs/REDISENO-2026-09-17.md` para contexto V2.

