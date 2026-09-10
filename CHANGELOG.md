# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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