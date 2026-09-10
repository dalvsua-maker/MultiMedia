# Neon Setup — plataforma-contenidos-dev

Este proyecto usa **Neon (Postgres serverless)** como DB real (pooled para app/vitest, direct para migrate) y mantiene `docker-compose.yml` como fallback offline.

## 1. Crear proyecto Neon (desde cero)

### Opción A — Dashboard (recomendado si no tienes API key)
1. Ve a https://console.neon.tech → **New Project**
2. Name: `plataforma-contenidos-dev`, Region: `eu-central-1` (o `us-east-2`), Postgres 16, Branch `main` (se crea por defecto).
3. En **Dashboard → Connection Details** copia **dos** URLs:
   - **Pooled** (`-pooler`): `postgresql://<user>:<pass>@ep-...-pooler.eu-central-1.aws.neon.tech/plataforma_contenidos?sslmode=require`
   - **Direct**: `postgresql://<user>:<pass>@ep-....eu-central-1.aws.neon.tech/plataforma_contenidos?sslmode=require`
   Guárdalas — no se commitean.

### Opción B — CLI (si tienes `NEON_API_KEY`)
```bash
# 1. Consigue tu API key en https://console.neon.tech/app/settings/api-keys
# 2. Exporta
$env:NEON_API_KEY="napi_...."  # PowerShell
# Linux/macOS: export NEON_API_KEY=napi_....

# 3. Crea proyecto + branch main (ya viene por defecto)
npx neonctl projects create --name plataforma-contenidos-dev --region-id aws-eu-central-1 --output json

# 4. Obtén las dos URLs
npx neonctl connection-string --project-id <id> --pooled        # pooled
npx neonctl connection-string --project-id <id> --pooled false  # direct
```

## 2. Configurar .env (dual URL)

```bash
# .env (gitignoreado, ya existe — edítalo)
DATABASE_URL=postgresql://<pooled-con-pooler>?sslmode=require   # ← pooled para app + vitest
DIRECT_URL=postgresql://<direct-sin-pooler>?sslmode=require     # ← direct solo para migrate deploy

# Alternativa si tu ORM solo lee DATABASE_URL:
# Para migrar, sobreescribe temporalmente:
# $env:DATABASE_URL=$env:DIRECT_URL; npx prisma migrate deploy
# o: DATABASE_URL=$DIRECT_URL npx prisma migrate deploy (bash)
```

> **Por qué dos URLs:** Neon recomienda Pooled (PgBouncer) para la app (evita agotar conexiones en Next.js) y Direct para `prisma migrate deploy` (PgBouncer no soporta DDL en transacción). Patrón oficial.

## 3. Aplicar migración (Opción C1 — historial trazado)

La migración ya está en `prisma/migrations/20250826000000_001_schema_inicial/migration.sql` con timestamp (renombrada de `001_schema_inicial`).

```bash
# Con Direct URL
$env:DATABASE_URL="postgresql://...direct...?sslmode=require"
npx prisma migrate deploy
# Verifica
npx prisma migrate status
# En Neon SQL Editor: SELECT * FROM _prisma_migrations;
```

Si prefieres SQL manual (no recomendado, deja _prisma_migrations vacío):
```bash
# Usa el SQL plano en prisma/001_schema_inicial.sql
psql "postgresql://...direct...?sslmode=require" -f prisma/001_schema_inicial.sql
```

## 4. Verificar tests de integración contra Neon (no skip)

```bash
# Pooled para tests (evita agotar conexiones)
$env:DATABASE_URL="postgresql://...pooled...?sslmode=require"
$env:JWT_SECRET="cambia-este-secreto-en-produccion"
npx vitest run tests/integration/PrismaListaRepository.test.ts --reporter=verbose
# Debe pasar: "create + findByUsuarioId + findByIdWithContenidos" y "contenidoExists"
# Antes: hacía SKIP (canConnect false). Ahora: 2 passed reales.

# Todo verde
npm run lint
npm run build
npx vitest run
```

## 5. Fallback local (offline)

```bash
docker compose up -d          # postgres:16-alpine en 5432
# .env local:
DATABASE_URL=postgresql://usuario:password@localhost:5432/plataforma_contenidos
npx prisma migrate deploy      # aplica la misma migración timestamped
npx vitest run tests/integration/PrismaListaRepository.test.ts
```

## 6. Adapter

Quedamos con `@prisma/adapter-pg` + `pg` (ya en `src/infrastructure/database/prisma.ts:2,11`). Funciona con Neon si la URL lleva `?sslmode=require`. Migrar a `@prisma/adapter-neon` solo si despliegas en Edge (no es el caso).

## 7. Checklist Done

- [ ] Proyecto Neon `plataforma-contenidos-dev` / branch `main` creado
- [ ] `.env` con `DATABASE_URL` (pooled) y `DIRECT_URL` (direct)
- [ ] `npx prisma migrate deploy` OK (tabla `_prisma_migrations` con `20250826000000_001_schema_inicial`)
- [ ] `npx vitest run tests/integration/PrismaListaRepository.test.ts` → 2 passed reales (no SKIP)
- [ ] `npm run lint && npm run build && npx vitest run` → 37 passed
