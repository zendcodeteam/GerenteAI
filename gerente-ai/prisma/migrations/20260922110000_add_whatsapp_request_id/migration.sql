-- Permite contar una sola unidad por mensaje entrante de WhatsApp.
ALTER TABLE "ConsumoIa" ADD COLUMN "solicitudId" TEXT;

CREATE UNIQUE INDEX "ConsumoIa_negocioId_solicitudId_key"
    ON "ConsumoIa"("negocioId", "solicitudId");
