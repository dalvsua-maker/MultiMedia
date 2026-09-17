-- AlterTable
ALTER TABLE "contenidos" ADD COLUMN "popularidad_externa" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "contenidos_popularidad_externa_idx" ON "contenidos"("popularidad_externa");
