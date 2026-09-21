-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "mfaBloqueadoHasta" TIMESTAMP(3),
ADD COLUMN "mfaIntentosFallidos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "mfaUltimoPaso" INTEGER;
