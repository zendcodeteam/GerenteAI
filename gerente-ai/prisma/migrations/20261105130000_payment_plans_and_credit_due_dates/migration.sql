ALTER TABLE "CuentaPorPagarProveedor"
  ADD COLUMN "numeroCuotas" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "interesMensualPorcentaje" DECIMAL NOT NULL DEFAULT 0;

CREATE TABLE "CuotaPorPagarProveedor" (
  "id" TEXT NOT NULL,
  "cuentaPorPagarId" TEXT NOT NULL,
  "numero" INTEGER NOT NULL,
  "capital" DECIMAL NOT NULL,
  "interes" DECIMAL NOT NULL,
  "monto" DECIMAL NOT NULL,
  "saldoPendiente" DECIMAL NOT NULL,
  "fechaVencimiento" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CuotaPorPagarProveedor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CuotaPorPagarProveedor_cuentaPorPagarId_numero_key"
  ON "CuotaPorPagarProveedor"("cuentaPorPagarId", "numero");
CREATE INDEX "CuotaPorPagarProveedor_cuentaPorPagarId_fechaVencimiento_idx"
  ON "CuotaPorPagarProveedor"("cuentaPorPagarId", "fechaVencimiento");

ALTER TABLE "CuotaPorPagarProveedor"
  ADD CONSTRAINT "CuotaPorPagarProveedor_cuentaPorPagarId_fkey"
  FOREIGN KEY ("cuentaPorPagarId") REFERENCES "CuentaPorPagarProveedor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Conserva el plan histórico de cada cuenta como una sola cuota sin interés.
INSERT INTO "CuotaPorPagarProveedor" (
  "id", "cuentaPorPagarId", "numero", "capital", "interes", "monto",
  "saldoPendiente", "fechaVencimiento"
)
SELECT
  gen_random_uuid()::text,
  c."id",
  1,
  c."montoOriginal",
  0,
  c."montoOriginal",
  c."saldoPendiente",
  c."fechaVencimiento"
FROM "CuentaPorPagarProveedor" c;

-- Los fiados existentes usan el plazo estándar actual de 30 días desde la venta.
UPDATE "Venta"
SET "fechaVencimiento" = "fecha" + INTERVAL '30 days'
WHERE "tipo" = 'FIADO'
  AND "fechaVencimiento" IS NULL;