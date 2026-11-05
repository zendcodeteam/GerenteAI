-- AlterTable
ALTER TABLE "Producto" 
  ALTER COLUMN "categoria" SET NOT NULL,
  ADD COLUMN IF NOT EXISTS "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Producto_categoria_idx" ON "Producto"("categoria");

-- Check Constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_producto_stock'
  ) THEN
    ALTER TABLE "Producto" ADD CONSTRAINT check_producto_stock CHECK ("stock" >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_producto_precio_compra'
  ) THEN
    ALTER TABLE "Producto" ADD CONSTRAINT check_producto_precio_compra CHECK ("precioCompra" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_producto_precio_venta'
  ) THEN
    ALTER TABLE "Producto" ADD CONSTRAINT check_producto_precio_venta CHECK ("precioVenta" > 0);
  END IF;
END $$;
