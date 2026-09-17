-- CreateEnum
CREATE TYPE "VotoRecomendacion" AS ENUM ('me_gusta', 'no_me_gusta', 'ya_lo_vi');

-- CreateTable
CREATE TABLE "historial_usuario_contenido" (
    "usuario_id" UUID NOT NULL,
    "contenido_id" UUID NOT NULL,
    "fecha_anadido" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_eliminado" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_usuario_contenido_pkey" PRIMARY KEY ("usuario_id","contenido_id")
);

-- CreateTable
CREATE TABLE "recomendacion_feedback" (
    "usuario_id" UUID NOT NULL,
    "contenido_id" UUID NOT NULL,
    "voto" "VotoRecomendacion" NOT NULL,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recomendacion_feedback_pkey" PRIMARY KEY ("usuario_id","contenido_id")
);

-- CreateIndex
CREATE INDEX "historial_usuario_contenido_usuario_id_idx" ON "historial_usuario_contenido"("usuario_id");

-- CreateIndex
CREATE INDEX "recomendacion_feedback_usuario_id_idx" ON "recomendacion_feedback"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "comparticiones_usuario_origen_id_usuario_destino_id_conteni_key" ON "comparticiones"("usuario_origen_id", "usuario_destino_id", "contenido_id") WHERE ("estado" = 'pendiente');

-- AddForeignKey
ALTER TABLE "historial_usuario_contenido" ADD CONSTRAINT "historial_usuario_contenido_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_usuario_contenido" ADD CONSTRAINT "historial_usuario_contenido_contenido_id_fkey" FOREIGN KEY ("contenido_id") REFERENCES "contenidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recomendacion_feedback" ADD CONSTRAINT "recomendacion_feedback_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recomendacion_feedback" ADD CONSTRAINT "recomendacion_feedback_contenido_id_fkey" FOREIGN KEY ("contenido_id") REFERENCES "contenidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;