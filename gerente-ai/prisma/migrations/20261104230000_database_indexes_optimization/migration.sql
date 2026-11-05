-- CreateIndex on Producto
CREATE INDEX IF NOT EXISTS "Producto_sedeId_categoria_idx" ON "Producto"("sedeId", "categoria");
CREATE INDEX IF NOT EXISTS "Producto_sedeId_nombre_idx" ON "Producto"("sedeId", "nombre");
CREATE INDEX IF NOT EXISTS "Producto_sedeId_stock_idx" ON "Producto"("sedeId", "stock");

-- CreateIndex on Cliente
CREATE INDEX IF NOT EXISTS "Cliente_sedeId_idx" ON "Cliente"("sedeId");
CREATE INDEX IF NOT EXISTS "Cliente_sedeId_saldoPendiente_idx" ON "Cliente"("sedeId", "saldoPendiente");
CREATE INDEX IF NOT EXISTS "Cliente_sedeId_telefono_idx" ON "Cliente"("sedeId", "telefono");
CREATE INDEX IF NOT EXISTS "Cliente_sedeId_nombre_idx" ON "Cliente"("sedeId", "nombre");

-- CreateIndex on Venta
CREATE INDEX IF NOT EXISTS "Venta_sedeId_tipo_saldoPendiente_idx" ON "Venta"("sedeId", "tipo", "saldoPendiente");
CREATE INDEX IF NOT EXISTS "Venta_sedeId_saldoPendiente_fechaVencimiento_idx" ON "Venta"("sedeId", "saldoPendiente", "fechaVencimiento");

-- CreateIndex on DetalleVenta
CREATE INDEX IF NOT EXISTS "DetalleVenta_ventaId_idx" ON "DetalleVenta"("ventaId");

-- CreateIndex on Compra
CREATE INDEX IF NOT EXISTS "Compra_proveedorId_fecha_idx" ON "Compra"("proveedorId", "fecha");

-- CreateIndex on Abono
CREATE INDEX IF NOT EXISTS "Abono_ventaId_idx" ON "Abono"("ventaId");

-- CreateIndex on CuentaPorPagarProveedor
CREATE INDEX IF NOT EXISTS "CuentaPorPagarProveedor_sedeId_saldoPendiente_idx" ON "CuentaPorPagarProveedor"("sedeId", "saldoPendiente");

-- CreateIndex on PagoProveedor
CREATE INDEX IF NOT EXISTS "PagoProveedor_fecha_idx" ON "PagoProveedor"("fecha");
