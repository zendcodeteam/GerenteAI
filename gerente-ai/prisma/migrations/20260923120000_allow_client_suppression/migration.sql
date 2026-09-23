-- Preserve accounting movements while removing the third party identity.
ALTER TABLE "Abono" ALTER COLUMN "clienteId" DROP NOT NULL;

ALTER TABLE "Abono" DROP CONSTRAINT IF EXISTS "Abono_clienteId_fkey";
ALTER TABLE "Abono"
  ADD CONSTRAINT "Abono_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Venta" DROP CONSTRAINT IF EXISTS "Venta_clienteId_fkey";
ALTER TABLE "Venta"
  ADD CONSTRAINT "Venta_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;