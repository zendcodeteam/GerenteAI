-- Persistencia de metas, cierres y obligaciones del dashboard.
CREATE TABLE "DashboardConfig" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "negocioId" TEXT NOT NULL,
    "sedeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DashboardConfig_negocioId_scopeId_clave_key"
    ON "DashboardConfig"("negocioId", "scopeId", "clave");

CREATE INDEX "DashboardConfig_sedeId_clave_idx"
    ON "DashboardConfig"("sedeId", "clave");

ALTER TABLE "DashboardConfig"
    ADD CONSTRAINT "DashboardConfig_negocioId_fkey"
    FOREIGN KEY ("negocioId") REFERENCES "Negocio"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DashboardConfig"
    ADD CONSTRAINT "DashboardConfig_sedeId_fkey"
    FOREIGN KEY ("sedeId") REFERENCES "Sede"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
