# Contexto del Proyecto: Plataforma de Gestión de Contenidos Multimedia

Este documento reúne todo el contexto de análisis, diseño, arquitectura, contrato de API, modelo de datos y stack técnico para continuar el desarrollo del proyecto de forma fluida.

---

## 1. Visión General del Proyecto

Una plataforma web/multiplataforma donde los usuarios pueden **buscar, organizar, seguir el estado y compartir contenidos de entretenimiento** (películas, series, videojuegos y música).

### Características Principales:
* **Listas personalizadas**: Creación de listas temáticas o por tipo (ej. "Canciones", "Spiderman", "Juegos pendientes").
* **Gestión de estados**: Cada usuario gestiona sus contenidos de forma personal con 3 estados: `pendiente`, `en_proceso` y `visto`.
* **Búsqueda unificada**: Integración con APIs externas (TMDB para películas/series, IGDB para videojuegos, Spotify para música) para buscar y añadir contenidos fácilmente.
* **Sistema de compartición**: Compartir contenidos directamente con otros usuarios, permitiendo aceptarlos o rechazarlos.
* **Pantalla de inicio inteligente**: 
  * Bloque **"Continuar"**: Muestra rápidamente los contenidos que el usuario tiene `en_proceso`.
  * Bloque **"Recomendado para ti"**: Motor v2 (4 por tipo ×4 tipos=16, pool TOP50 por `popularidadExterna` + shuffle, afinidad por tipo, excluye poseídos/feedback `no_me_gusta`/`ya_lo_vi`, badge sutil `Ya añadido` si estuvo en historial).

---

## 2. Stack Tecnológico y Arquitectura

* **Enfoque**: Next.js Full-Stack (Un único repositorio y despliegue).
* **Framework Web / Backend**: **Next.js (App Router)** con TypeScript. Los *Route Handlers* (`app/api/.../route.ts`) sustituyen el backend dedicado.
* **Base de Datos & ORM**: **PostgreSQL** administrado a través de **Prisma ORM**.
* **Patrón Arquitectónico**: **Domain-Driven Design (DDD) / Arquitectura Limpia** alojada en la carpeta `src/`.

### Estructura de Directorios Target (DDD)

```text
/
├── app/                        # Capa HTTP / Presentación (Next.js App Router)
│   ├── api/                    # Route Handlers (endpoints API REST)
│   │   ├── auth/               # /api/auth/login, /api/auth/register
│   │   ├── contenidos/         # /api/contenidos, /api/contenidos/buscar
│   │   ├── inicio/             # /api/inicio (UC6)
│   │   ├── listas/             # /api/listas
│   │   ├── usuario-contenido/  # /api/usuario-contenido
│   │   └── comparticiones/     # /api/comparticiones
   ├── usuarios/buscar/     # /api/usuarios/buscar (UC5)
   ├── contenidos/[id]/publico/ # /api/contenidos/:id/publico (UC5)
│   ├── (dashboard)/            # Vistas/Pantallas de la aplicación React
│   ├── layout.tsx
│   └── page.tsx
├── src/                        # Núcleo de la Aplicación (DDD)
│   ├── domain/                 # Reglas de negocio e interfaces puras (sin librerías externas)
│   │   ├── entities/           # Usuario, Contenido, Lista, Comparticion, etc.
│   │   ├── repositories/       # Interfaces (IUsuarioRepository, IListaRepository, etc.)
│   │   └── services/           # Interfaces (IRecomendacionService, IExternalSearchService)
│   ├── application/            # Casos de uso y DTOs
│   │   ├── dtos/
│   │   └── use-cases/          # RegistrarUsuario, CrearLista, ObtenerInicio, etc.
│   └── infrastructure/         # Implementaciones concretas de detalles técnicos
│       ├── database/           # Cliente Prisma Singleton
│       ├── repositories/       # PrismaUsuarioRepository, PrismaListaRepository, etc.
│       └── services/           # Adaptadores TMDB, IGDB, Spotify y Algoritmo de Recomendación
├── prisma/
│   └── schema.prisma           # Definición del esquema de datos
└── package.json
```

---

## 3. Casos de Uso Detallados (UC1 - UC6)

* **UC1 — Buscar contenido**: Usuario busca término + selecciona tipo (`pelicula`, `serie`, `videojuego`, `musica`). Consulta adaptadores externos (TMDB, IGDB, Spotify) y devuelve resultados normalizados. Control de errores si la API externa no responde.
* **UC2 — Añadir contenido a cuenta/lista**: Usuario selecciona un resultado de búsqueda. El sistema comprueba si el contenido ya existe globalmente por `(fuente_externa, id_externo)`. Si no existe, lo crea (junto con su tabla de detalle 1:1). Si existe, lo reutiliza sin duplicar. Crea la asociación `usuario_contenido` con estado `pendiente` y opcionalmente lo vincula a una lista.
* **UC3 — Crear y gestionar listas**: El usuario crea listas con nombre y descripción. Añade o elimina contenidos de sus listas.
* **UC4 — Cambiar estado de contenido**: Usuario cambia el estado (`pendiente` -> `en_proceso` -> `visto`) de un contenido en su perfil (`usuario_contenido.estado`).
* **UC5 — Compartir contenido**: Usuario A comparte un contenido a Usuario B. Se crea un registro en `comparticiones` con estado `pendiente`. Al aceptar, se vincula automáticamente al `usuario_contenido` del Usuario B como `pendiente`. Al rechazar, se marca como `rechazada`.
* **UC6 — Pantalla de inicio**: Devuelve dos bloques: contenidos en `en_proceso` y recomendaciones v2 (4 por tipo, pool TOP50 por `popularidadExterna` + shuffle, `yaAnadido` via historial, excluye poseídos + feedback `no_me_gusta`/`ya_lo_vi`, 3 votos `me_gusta`/`no_me_gusta`/`ya_lo_vi` con deshacer).

---

## 4. Contrato de la API REST

```http
-- Autenticación
POST   /api/auth/register              -> Registro de usuario
POST   /api/auth/login                 -> Inicio de sesión, devuelve JWT

-- Contenidos y Búsqueda
GET    /api/contenidos/buscar?tipo=&q= -> UC1: Buscar en APIs externas
POST   /api/contenidos                 -> UC2: Guardar o reutilizar contenido global
GET    /api/contenidos/:id             -> Detalle de un contenido
GET    /api/contenidos/:id/publico     -> UC5: Vista previa publica SIN auth (no expone estadoUsuario)
GET    /api/usuarios/buscar?q=         -> UC5: Buscar usuarios (auth, q>=2, ILIKE asc, limit 10, sin email)

-- Listas
GET    /api/listas                     -> Obtener listas del usuario autenticado
POST   /api/listas                     -> UC3: Crear nueva lista
GET    /api/listas/:id                 -> Detalle de lista + sus contenidos
POST   /api/listas/:id/contenidos      -> Añadir contenido a lista
DELETE /api/listas/:id/contenidos/:cid -> Quitar contenido de lista

-- Estado Personal de Contenidos
GET    /api/usuario-contenido          -> Mis contenidos con su estado personal
PATCH  /api/usuario-contenido/:cid     -> UC4: Actualizar estado (pendiente, en_proceso, visto)
DELETE /api/usuario-contenido/:cid     -> UC4: Eliminar de Mis contenidos + listas + historial

-- Comparticiones
POST   /api/comparticiones             -> UC5: Compartir contenido con otro usuario
GET    /api/comparticiones             -> Obtener comparticiones recibidas/enviadas
PATCH  /api/comparticiones/:id         -> Aceptar o rechazar compartición

-- Inicio / Dashboard
GET    /api/inicio                     -> UC6: Devuelve { enProceso: [...], recomendaciones: [...], recomendacionesPorTipo: { pelicula:[], serie:[], videojuego:[], musica:[] } }
POST   /api/recomendaciones/feedback   -> UC6: Votar me_gusta/no_me_gusta/ya_lo_vi
DELETE /api/recomendaciones/feedback/:cid -> UC6: Deshacer voto
```

---

## 5. Esquema de Base de Datos Prisma (`prisma/schema.prisma`) — volcado literal verificado 2026-09-17

> Fuente literal: `prisma/schema.prisma` en disco (Prisma 7.10, `previewFeatures: ["partialIndexes"]`). `prisma.config.ts` define `datasource.url` via `defineConfig` con `DATABASE_URL ?? DIRECT_URL` (requiere `?sslmode=require` en Neon) — no duplicar `url` en schema.

```prisma
datasource db {
  provider = "postgresql"
}

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["partialIndexes"]
}

enum TipoContenido {
  pelicula
  serie
  videojuego
  musica
}

enum FuenteExterna {
  tmdb
  igdb
  spotify
}

enum EstadoContenido {
  pendiente
  en_proceso
  visto
}

enum EstadoComparticion {
  pendiente
  aceptada
  rechazada
}

enum VotoRecomendacion {
  me_gusta
  no_me_gusta
  ya_lo_vi
}

model Usuario {
  id                      String             @id @default(uuid()) @db.Uuid
  nombre                  String             @db.VarChar(100)
  email                   String             @unique @db.VarChar(255)
  passwordHash            String             @map("password_hash") @db.VarChar(255)
  fechaRegistro           DateTime           @default(now()) @map("fecha_registro") @db.Timestamptz
  listas                  Lista[]
  usuarioContenidos       UsuarioContenido[]
  comparticionesEnviadas  Comparticion[]     @relation("Origen")
  comparticionesRecibidas Comparticion[]     @relation("Destino")
  historial               HistorialUsuarioContenido[]
  feedbacks               RecomendacionFeedback[]

  @@map("usuarios")
}

model Contenido {
  id                  String             @id @default(uuid()) @db.Uuid
  tipo                TipoContenido
  titulo              String             @db.VarChar(255)
  imagenUrl           String?            @map("imagen_url") @db.Text
  fuenteExterna       FuenteExterna      @map("fuente_externa")
  idExterno           String             @map("id_externo") @db.VarChar(100)
  fechaAnadido        DateTime           @default(now()) @map("fecha_anadido") @db.Timestamptz
  popularidadExterna  Float?             @map("popularidad_externa")
  detallePelicula     DetallePelicula?
  detalleSerie        DetalleSerie?
  detalleVideojuego   DetalleVideojuego?
  detalleMusica       DetalleMusica?
  listas              ListaContenido[]
  usuarios            UsuarioContenido[]
  comparticiones      Comparticion[]
  historiales         HistorialUsuarioContenido[]
  feedbacks           RecomendacionFeedback[]

  @@unique([fuenteExterna, idExterno])
  @@index([tipo])
  @@index([popularidadExterna])
  @@map("contenidos")
}

model DetallePelicula {
  contenidoId String    @id @map("contenido_id") @db.Uuid
  duracionMin Int?      @map("duracion_min")
  director    String?   @db.VarChar(255)
  anio        Int?
  contenido   Contenido @relation(fields: [contenidoId], references: [id], onDelete: Cascade)

  @@map("detalle_peliculas")
}

model DetalleSerie {
  contenidoId   String    @id @map("contenido_id") @db.Uuid
  numTemporadas Int?      @map("num_temporadas")
  numEpisodios  Int?      @map("num_episodios")
  anioInicio    Int?      @map("anio_inicio")
  contenido     Contenido @relation(fields: [contenidoId], references: [id], onDelete: Cascade)

  @@map("detalle_series")
}

model DetalleVideojuego {
  contenidoId     String    @id @map("contenido_id") @db.Uuid
  plataformas     String[]  @db.Text
  desarrollador   String?   @db.VarChar(255)
  anioLanzamiento Int?      @map("anio_lanzamiento")
  contenido       Contenido @relation(fields: [contenidoId], references: [id], onDelete: Cascade)

  @@map("detalle_videojuegos")
}

model DetalleMusica {
  contenidoId String    @id @map("contenido_id") @db.Uuid
  artista     String?   @db.VarChar(255)
  album       String?   @db.VarChar(255)
  duracionSeg Int?      @map("duracion_seg")
  contenido   Contenido @relation(fields: [contenidoId], references: [id], onDelete: Cascade)

  @@map("detalle_musica")
}

model Lista {
  id            String           @id @default(uuid()) @db.Uuid
  usuarioId     String           @map("usuario_id") @db.Uuid
  nombre        String           @db.VarChar(100)
  descripcion   String?          @db.Text
  fechaCreacion DateTime         @default(now()) @map("fecha_creacion") @db.Timestamptz
  usuario       Usuario          @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  contenidos    ListaContenido[]

  @@map("listas")
}

model ListaContenido {
  listaId      String    @map("lista_id") @db.Uuid
  contenidoId  String    @map("contenido_id") @db.Uuid
  fechaAnadido DateTime  @default(now()) @map("fecha_anadido") @db.Timestamptz
  lista        Lista     @relation(fields: [listaId], references: [id], onDelete: Cascade)
  contenido    Contenido @relation(fields: [contenidoId], references: [id], onDelete: Cascade)

  @@id([listaId, contenidoId])
  @@map("lista_contenido")
}

model UsuarioContenido {
  usuarioId          String          @map("usuario_id") @db.Uuid
  contenidoId        String          @map("contenido_id") @db.Uuid
  estado             EstadoContenido @default(pendiente)
  fechaActualizacion DateTime        @default(now()) @map("fecha_actualizacion") @db.Timestamptz
  usuario            Usuario         @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  contenido          Contenido       @relation(fields: [contenidoId], references: [id], onDelete: Cascade)

  @@id([usuarioId, contenidoId])
  @@index([usuarioId])
  @@map("usuario_contenido")
}

model Comparticion {
  id               String             @id @default(uuid()) @db.Uuid
  contenidoId      String             @map("contenido_id") @db.Uuid
  usuarioOrigenId  String             @map("usuario_origen_id") @db.Uuid
  usuarioDestinoId String             @map("usuario_destino_id") @db.Uuid
  estado           EstadoComparticion @default(pendiente)
  fechaEnvio       DateTime           @default(now()) @map("fecha_envio") @db.Timestamptz
  contenido        Contenido          @relation(fields: [contenidoId], references: [id], onDelete: Cascade)
  usuarioOrigen    Usuario            @relation("Origen", fields: [usuarioOrigenId], references: [id], onDelete: Cascade)
  usuarioDestino   Usuario            @relation("Destino", fields: [usuarioDestinoId], references: [id], onDelete: Cascade)

  @@index([usuarioDestinoId, estado])
  @@unique([usuarioOrigenId, usuarioDestinoId, contenidoId], where: { estado: "pendiente" })
  @@map("comparticiones")
}

model HistorialUsuarioContenido {
  usuarioId      String   @map("usuario_id") @db.Uuid
  contenidoId    String   @map("contenido_id") @db.Uuid
  fechaAnadido   DateTime @default(now()) @map("fecha_anadido") @db.Timestamptz
  fechaEliminado DateTime @default(now()) @map("fecha_eliminado") @db.Timestamptz
  usuario        Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  contenido      Contenido @relation(fields: [contenidoId], references: [id], onDelete: Cascade)

  @@id([usuarioId, contenidoId])
  @@index([usuarioId])
  @@map("historial_usuario_contenido")
}

model RecomendacionFeedback {
  usuarioId   String            @map("usuario_id") @db.Uuid
  contenidoId String            @map("contenido_id") @db.Uuid
  voto        VotoRecomendacion
  fecha       DateTime          @default(now()) @map("fecha") @db.Timestamptz
  usuario     Usuario           @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  contenido   Contenido         @relation(fields: [contenidoId], references: [id], onDelete: Cascade)

  @@id([usuarioId, contenidoId])
  @@index([usuarioId])
  @@map("recomendacion_feedback")
}
```

> Nota: `prisma/migrations/20250826000000_001_schema_inicial` + `20250917000000_add_historial_y_feedback` + `20250917000001_add_popularidad_externa` (3 migraciones). `prisma/001_schema_inicial.sql` es fallback solo de C1, no incluye V2.

---

## 6. Estado Actual del Proyecto — verificado 2026-09-17

### Estado Actual (auditoria 2026-09-17, `npm test && npm run lint && npm run build` en verde):
* **UC1-UC6 verde — backend y frontend completos + rediseño recomendaciones**. 18 Route Handlers `src/app/api/**/route.ts` + 22 use-cases `src/application/use-cases/**` + 5 `Prisma*Repository` + 3 adapters externos (TMDB/IGDB/Spotify `fetch 5s, limit 10`, `obtenerPopulares` paginado) + `RecomendacionServiceV2` (pool TOP50 por `popularidadExterna` + shuffle, 4×4=16, `yaAnadido` via `historial`, excluye `usuario_contenido` + `feedback`).
* **Stack:** Next.js 16.3.3 App Router + TypeScript strict + Tailwind 4 + Prisma 7.10 (`@prisma/client` 7.10, `prisma` 7.10, `@prisma/adapter-pg` + `pg`, `prisma.config.ts` con `defineConfig` + `partialIndexes`) + PostgreSQL Neon (`plataforma-contenidos-dev`, pooled `DATABASE_URL` / direct `DIRECT_URL` con `?sslmode=require`, catálogo 360 reales 90×4 con `popularidadExterna` TMDB `popularity` / IGDB `total_rating` / Spotify `popularity`) + `bcryptjs` + `jsonwebtoken` + `vitest` 4.1.11.
* **Verificado:** `npm test -- --run` → `27 passed / 217 passed | 1 skipped` (vitest, 3 nuevos V2), `npm run lint` → `0 errors, 14 warnings (eslint-disable)`, `npm run build` → `Compiled successfully` con 18 `ƒ Dynamic` + 6 `○ Static`. `npx prisma migrate status` → `3 migrations — Database schema is up to date!` (ver `docs/REDISENO-2026-09-17.md`).
* **Páginas:** `/dashboard` (UC6 V2 4×4 con `yaAnadido`, 3 votos, `Añadir`, shuffle, `Deshacer`), `/buscar` (UC1+UC2), `/mis-contenidos` (UC4 con `DELETE` + confirm + listas + historial + filtros), `/listas`, `/listas/:id` (UC3 con `estado` por contenido), `/comparticiones` (UC5), `/compartido/:id` (público), `/login`, `/register`.

| UC | Ruta | Use-case | Estado 2026-09-17 |
|----|------|----------|-------------------|
| UC1 | `GET /api/contenidos/buscar?tipo=&q=` | `BuscarContenidoUseCase` (+ `obtenerPopulares` paginado en adapters) | verde |
| UC2 | `POST /api/contenidos` + `GET /api/contenidos/:id` | `CrearContenido` + `ObtenerContenidoDetalle` (guarda `popularidadExterna`) | verde |
| UC3 | `GET|POST /api/listas`, `GET /api/listas/:id`, `POST .../contenidos`, `DELETE .../:cid` | `CrearLista` etc. (5 use-cases) + `ObtenerListaDetalle` con `estado` | verde |
| UC4 | `GET /api/usuario-contenido` + `PATCH /api/usuario-contenido/:cid` + `DELETE /api/usuario-contenido/:cid` | `Listar` + `ActualizarEstado` + `EliminarUsuarioContenido` (borra + listas + historial) | verde |
| UC5 | `GET /api/contenidos/:id/publico` (SIN auth) + `GET /api/usuarios/buscar` (auth) + `POST|GET /api/comparticiones` + `PATCH /api/comparticiones/:id` | `ObtenerPublico`, `BuscarUsuarios`, `Compartir` (200/201), `Responder` (`yaExistia`) | verde |
| UC6 | `GET /api/inicio` + `POST|DELETE /api/recomendaciones/feedback` | `ObtenerInicio` (`RecomendacionServiceV2` TOP50+shuffle 4×4, `yaAnadido`, `feedback` 3 votos) | verde V2 |
| Auth | `POST /api/auth/register|login` | `Registrar`, `Login` | verde |

### Pendiente / Riesgos:
* **DONE 2026-09-17:** BUG-01 resuelto en `20250917000000_add_historial_y_feedback` (índice parcial `comparticiones` aplicado), catálogo ampliado 360 reales, `popularidadExterna` migrado, V2 con pool real TOP50 en vez de dummy `usuario_contenido`.
* **INFO:** `prisma/001_schema_inicial.sql` sigue siendo snapshot C1 (no incluye V2), usar solo `prisma/migrations/` para deploy.

### Referencias:
* Fuente canonica operativa breve: `AGENTS.md` (notas para agentes, contrato resumido, claves que rompen).
* Historial: `CHANGELOG.md` `0.2.0` (2026-09-17, rediseño V2) + `0.1.0` (2026-09-07, UC5) + `0.0.1` (2026-08-26, base).
* Rediseño: `docs/REDISENO-2026-09-17.md` (pool falso → popularidadExterna real, 360 catálogo, TOP50+shuffle).
* Auditoria completa: `docs/AUDITORIA-2026-09-10.md` (histórica, 3 secciones + hallazgos).
