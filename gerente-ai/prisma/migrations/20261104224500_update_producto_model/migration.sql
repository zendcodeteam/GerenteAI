-- Modelo de producto completo: categoria obligatoria, fechas de auditoria y
-- los limites numericos que el catalogo da por sentados.
--
-- La migracion esta escrita para correr sobre una base QUE YA TIENE DATOS. Una
-- que solo funciona en limpio no sirve: en produccion hay catalogo cargado
-- desde antes de que la categoria fuera obligatoria.

-- La categoria era opcional, asi que puede haber productos viejos sin ella.
-- Se rellenan ANTES de exigirla: sin este paso `SET NOT NULL` falla con
-- "column categoria contains null values" y se cae el despliegue entero.
UPDATE "Producto"
   SET "categoria" = 'Sin categoría'
 WHERE "categoria" IS NULL;

-- AlterTable
ALTER TABLE "Producto"
  ALTER COLUMN "categoria" SET NOT NULL,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Check constraints: las mismas reglas que valida el servicio, pero en la
-- base. Ahi no llegan solo las peticiones HTTP, y una cantidad negativa o un
-- precio en cero descuadran el inventario y el margen sin que nadie se entere.
--
-- Van como NOT VALID a proposito. Hasta hoy el DTO aceptaba precios en 0
-- (@Min(0)), asi que es normal que existan filas asi, y un CHECK normal las
-- encontraria y abortaria la migracion. NOT VALID exige la regla a todo lo que
-- se inserte o actualice de aqui en adelante y deja en paz lo viejo. Cuando el
-- catalogo este limpio, se cierra el circulo con:
--
--   ALTER TABLE "Producto" VALIDATE CONSTRAINT check_producto_precio_compra;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_producto_stock'
  ) THEN
    ALTER TABLE "Producto"
      ADD CONSTRAINT check_producto_stock CHECK ("stock" >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_producto_stock_minimo'
  ) THEN
    ALTER TABLE "Producto"
      ADD CONSTRAINT check_producto_stock_minimo CHECK ("stockMinimo" >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_producto_precio_compra'
  ) THEN
    ALTER TABLE "Producto"
      ADD CONSTRAINT check_producto_precio_compra CHECK ("precioCompra" > 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_producto_precio_venta'
  ) THEN
    ALTER TABLE "Producto"
      ADD CONSTRAINT check_producto_precio_venta CHECK ("precioVenta" > 0) NOT VALID;
  END IF;
END $$;
