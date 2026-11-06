-- CreateTable
CREATE TABLE IF NOT EXISTS "PagoNomina" (
    "id" TEXT NOT NULL,
    "nombreTrabajador" TEXT NOT NULL,
    "porcentajePago" DECIMAL(5,2) NOT NULL,
    "montoExacto" DECIMAL(12,2) NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sedeId" TEXT NOT NULL,

    CONSTRAINT "PagoNomina_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PagoNomina_sedeId_fkey'
  ) THEN
    ALTER TABLE "PagoNomina" ADD CONSTRAINT "PagoNomina_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PagoNomina_sedeId_nombreTrabajador_idx" ON "PagoNomina"("sedeId", "nombreTrabajador");
CREATE INDEX IF NOT EXISTS "PagoNomina_sedeId_fechaPago_idx" ON "PagoNomina"("sedeId", "fechaPago");
CREATE INDEX IF NOT EXISTS "PagoNomina_nombreTrabajador_idx" ON "PagoNomina"("nombreTrabajador");

-- Check Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_pago_nomina_porcentaje'
  ) THEN
    ALTER TABLE "PagoNomina" ADD CONSTRAINT check_pago_nomina_porcentaje CHECK ("porcentajePago" >= 0 AND "porcentajePago" <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_pago_nomina_monto'
  ) THEN
    ALTER TABLE "PagoNomina" ADD CONSTRAINT check_pago_nomina_monto CHECK ("montoExacto" > 0);
  END IF;
END $$;
