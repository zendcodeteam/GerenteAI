-- CreateEnum
CREATE TYPE "ModalidadDeudaProveedor" AS ENUM ('UNICO', 'CUOTAS');

-- CreateEnum
CREATE TYPE "EstadoDeudaProveedor" AS ENUM ('PENDIENTE', 'PAGADA', 'VENCIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "DeudaProveedor" (
    "id" TEXT NOT NULL,
    "proveedorId" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "suministro" TEXT NOT NULL,
    "montoTotal" DECIMAL(65,30) NOT NULL,
    "fechaLimite" TIMESTAMP(3) NOT NULL,
    "modalidad" "ModalidadDeudaProveedor" NOT NULL,
    "numeroCuotas" INTEGER,
    "aplicaInteres" BOOLEAN NOT NULL DEFAULT false,
    "porcentajeInteres" DECIMAL(65,30),
    "estado" "EstadoDeudaProveedor" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeudaProveedor_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "check_deuda_interes" CHECK (
        ("aplicaInteres" = false) OR ("aplicaInteres" = true AND "porcentajeInteres" IS NOT NULL)
    ),
    CONSTRAINT "check_deuda_cuotas" CHECK (
        ("modalidad" != 'CUOTAS') OR ("modalidad" = 'CUOTAS' AND "numeroCuotas" IS NOT NULL AND "numeroCuotas" >= 2)
    )
);

-- CreateIndex
CREATE INDEX "DeudaProveedor_sedeId_estado_fechaLimite_idx" ON "DeudaProveedor"("sedeId", "estado", "fechaLimite");

-- CreateIndex
CREATE INDEX "DeudaProveedor_proveedorId_estado_idx" ON "DeudaProveedor"("proveedorId", "estado");

-- AddForeignKey
ALTER TABLE "DeudaProveedor" ADD CONSTRAINT "DeudaProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeudaProveedor" ADD CONSTRAINT "DeudaProveedor_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;
