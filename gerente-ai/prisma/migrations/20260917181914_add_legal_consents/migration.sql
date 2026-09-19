-- CreateEnum
CREATE TYPE "DocumentoLegal" AS ENUM ('TERMINOS_SERVICIO', 'POLITICA_PRIVACIDAD');

-- AlterTable
ALTER TABLE "Mensaje" ADD COLUMN     "movimientoIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "remitente" TEXT,
ADD COLUMN     "wamid" TEXT;

-- CreateTable
CREATE TABLE "ConsentimientoLegal" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "documento" "DocumentoLegal" NOT NULL,
    "version" TEXT NOT NULL,
    "aceptadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentimientoLegal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumoIa" (
    "id" TEXT NOT NULL,
    "negocioId" TEXT NOT NULL,
    "sedeId" TEXT,
    "feature" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costoUsd" DECIMAL(65,30) NOT NULL,
    "latenciaMs" INTEGER,
    "exitosa" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsumoIa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsentimientoLegal_usuarioId_idx" ON "ConsentimientoLegal"("usuarioId");

-- CreateIndex
CREATE INDEX "ConsentimientoLegal_documento_idx" ON "ConsentimientoLegal"("documento");

-- CreateIndex
CREATE INDEX "ConsentimientoLegal_usuarioId_documento_idx" ON "ConsentimientoLegal"("usuarioId", "documento");

-- CreateIndex
CREATE INDEX "ConsumoIa_negocioId_createdAt_idx" ON "ConsumoIa"("negocioId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsumoIa_sedeId_createdAt_idx" ON "ConsumoIa"("sedeId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsumoIa_providerId_createdAt_idx" ON "ConsumoIa"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsumoIa_feature_createdAt_idx" ON "ConsumoIa"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "ConsumoIa_exitosa_createdAt_idx" ON "ConsumoIa"("exitosa", "createdAt");

-- CreateIndex
CREATE INDEX "Mensaje_sedeId_fecha_idx" ON "Mensaje"("sedeId", "fecha");

-- CreateIndex
CREATE INDEX "Mensaje_wamid_idx" ON "Mensaje"("wamid");

-- AddForeignKey
ALTER TABLE "ConsentimientoLegal" ADD CONSTRAINT "ConsentimientoLegal_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoIa" ADD CONSTRAINT "ConsumoIa_negocioId_fkey" FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumoIa" ADD CONSTRAINT "ConsumoIa_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;
