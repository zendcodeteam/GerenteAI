-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "mfaActivado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mfaActivadoEn" TIMESTAMP(3),
ADD COLUMN     "mfaSecret" TEXT;
