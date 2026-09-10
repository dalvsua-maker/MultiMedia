-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoContenido" AS ENUM ('pelicula', 'serie', 'videojuego', 'musica');

-- CreateEnum
CREATE TYPE "FuenteExterna" AS ENUM ('tmdb', 'igdb', 'spotify');

-- CreateEnum
CREATE TYPE "EstadoContenido" AS ENUM ('pendiente', 'en_proceso', 'visto');

-- CreateEnum
CREATE TYPE "EstadoComparticion" AS ENUM ('pendiente', 'aceptada', 'rechazada');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "fecha_registro" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contenidos" (
    "id" UUID NOT NULL,
    "tipo" "TipoContenido" NOT NULL,
    "titulo" VARCHAR(255) NOT NULL,
    "imagen_url" TEXT,
    "fuente_externa" "FuenteExterna" NOT NULL,
    "id_externo" VARCHAR(100) NOT NULL,
    "fecha_anadido" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contenidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detalle_peliculas" (
    "contenido_id" UUID NOT NULL,
    "duracion_min" INTEGER,
    "director" VARCHAR(255),
    "anio" INTEGER,

    CONSTRAINT "detalle_peliculas_pkey" PRIMARY KEY ("contenido_id")
);

-- CreateTable
CREATE TABLE "detalle_series" (
    "contenido_id" UUID NOT NULL,
    "num_temporadas" INTEGER,
    "num_episodios" INTEGER,
    "anio_inicio" INTEGER,

    CONSTRAINT "detalle_series_pkey" PRIMARY KEY ("contenido_id")
);

-- CreateTable
CREATE TABLE "detalle_videojuegos" (
    "contenido_id" UUID NOT NULL,
    "plataformas" TEXT[],
    "desarrollador" VARCHAR(255),
    "anio_lanzamiento" INTEGER,

    CONSTRAINT "detalle_videojuegos_pkey" PRIMARY KEY ("contenido_id")
);

-- CreateTable
CREATE TABLE "detalle_musica" (
    "contenido_id" UUID NOT NULL,
    "artista" VARCHAR(255),
    "album" VARCHAR(255),
    "duracion_seg" INTEGER,

    CONSTRAINT "detalle_musica_pkey" PRIMARY KEY ("contenido_id")
);

-- CreateTable
CREATE TABLE "listas" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "fecha_creacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lista_contenido" (
    "lista_id" UUID NOT NULL,
    "contenido_id" UUID NOT NULL,
    "fecha_anadido" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lista_contenido_pkey" PRIMARY KEY ("lista_id","contenido_id")
);

-- CreateTable
CREATE TABLE "usuario_contenido" (
    "usuario_id" UUID NOT NULL,
    "contenido_id" UUID NOT NULL,
    "estado" "EstadoContenido" NOT NULL DEFAULT 'pendiente',
    "fecha_actualizacion" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_contenido_pkey" PRIMARY KEY ("usuario_id","contenido_id")
);

-- CreateTable
CREATE TABLE "comparticiones" (
    "id" UUID NOT NULL,
    "contenido_id" UUID NOT NULL,
    "usuario_origen_id" UUID NOT NULL,
    "usuario_destino_id" UUID NOT NULL,
    "estado" "EstadoComparticion" NOT NULL DEFAULT 'pendiente',
    "fecha_envio" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparticiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "contenidos_tipo_idx" ON "contenidos"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "contenidos_fuente_externa_id_externo_key" ON "contenidos"("fuente_externa", "id_externo");

-- CreateIndex
CREATE INDEX "usuario_contenido_usuario_id_idx" ON "usuario_contenido"("usuario_id");

-- CreateIndex
CREATE INDEX "comparticiones_usuario_destino_id_estado_idx" ON "comparticiones"("usuario_destino_id", "estado");

-- AddForeignKey
ALTER TABLE "detalle_peliculas" ADD CONSTRAINT "detalle_peliculas_contenido_id_fkey" FOREIGN KEY ("contenido_id") REFERENCES "contenidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_series" ADD CONSTRAINT "detalle_series_contenido_id_fkey" FOREIGN KEY ("contenido_id") REFERENCES "contenidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_videojuegos" ADD CONSTRAINT "detalle_videojuegos_contenido_id_fkey" FOREIGN KEY ("contenido_id") REFERENCES "contenidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detalle_musica" ADD CONSTRAINT "detalle_musica_contenido_id_fkey" FOREIGN KEY ("contenido_id") REFERENCES "contenidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listas" ADD CONSTRAINT "listas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_contenido" ADD CONSTRAINT "lista_contenido_lista_id_fkey" FOREIGN KEY ("lista_id") REFERENCES "listas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lista_contenido" ADD CONSTRAINT "lista_contenido_contenido_id_fkey" FOREIGN KEY ("contenido_id") REFERENCES "contenidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_contenido" ADD CONSTRAINT "usuario_contenido_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_contenido" ADD CONSTRAINT "usuario_contenido_contenido_id_fkey" FOREIGN KEY ("contenido_id") REFERENCES "contenidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparticiones" ADD CONSTRAINT "comparticiones_contenido_id_fkey" FOREIGN KEY ("contenido_id") REFERENCES "contenidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparticiones" ADD CONSTRAINT "comparticiones_usuario_origen_id_fkey" FOREIGN KEY ("usuario_origen_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparticiones" ADD CONSTRAINT "comparticiones_usuario_destino_id_fkey" FOREIGN KEY ("usuario_destino_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

