CREATE TYPE "EstadoCuentaProveedor" AS ENUM ('PENDIENTE', 'PAGADA', 'VENCIDA');

CREATE TABLE "CuentaPorPagarProveedor" (
  "id" TEXT NOT NULL,
  "compraId" TEXT NOT NULL,
  "proveedorId" TEXT NOT NULL,
  "sedeId" TEXT NOT NULL,
  "montoOriginal" DECIMAL NOT NULL,
  "saldoPendiente" DECIMAL NOT NULL,
  "fechaVencimiento" TIMESTAMP(3) NOT NULL,
  "estado" "EstadoCuentaProveedor" NOT NULL DEFAULT 'PENDIENTE',
  "recordatorioCincoDiasAt" TIMESTAMP(3),
  "recordatorioVencimientoAt" TIMESTAMP(3),
  CONSTRAINT "CuentaPorPagarProveedor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CuentaPorPagarProveedor_compraId_key" ON "CuentaPorPagarProveedor"("compraId");
CREATE INDEX "CuentaPorPagarProveedor_sedeId_estado_fechaVencimiento_idx" ON "CuentaPorPagarProveedor"("sedeId", "estado", "fechaVencimiento");
CREATE INDEX "CuentaPorPagarProveedor_proveedorId_estado_idx" ON "CuentaPorPagarProveedor"("proveedorId", "estado");

CREATE TABLE "PagoProveedor" (
  "id" TEXT NOT NULL,
  "cuentaPorPagarId" TEXT NOT NULL,
  "monto" DECIMAL NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PagoProveedor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PagoProveedor_cuentaPorPagarId_fecha_idx" ON "PagoProveedor"("cuentaPorPagarId", "fecha");

ALTER TABLE "CuentaPorPagarProveedor" ADD CONSTRAINT "CuentaPorPagarProveedor_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CuentaPorPagarProveedor" ADD CONSTRAINT "CuentaPorPagarProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CuentaPorPagarProveedor" ADD CONSTRAINT "CuentaPorPagarProveedor_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PagoProveedor" ADD CONSTRAINT "PagoProveedor_cuentaPorPagarId_fkey" FOREIGN KEY ("cuentaPorPagarId") REFERENCES "CuentaPorPagarProveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
