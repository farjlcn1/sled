-- CreateEnum
CREATE TYPE "TachoFileKind" AS ENUM ('VOZILO', 'VOZNIK');

-- AlterTable
ALTER TABLE "drivers" ADD COLUMN     "tachoDownloadPeriodDays" INTEGER NOT NULL DEFAULT 28,
ADD COLUMN     "tachoScheduleEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "tachoScheduleEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "tacho_files" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "TachoFileKind" NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "downloadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodFrom" TIMESTAMP(3),
    "periodTo" TIMESTAMP(3),
    "rawData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tacho_files_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tacho_files" ADD CONSTRAINT "tacho_files_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tacho_files" ADD CONSTRAINT "tacho_files_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tacho_files" ADD CONSTRAINT "tacho_files_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
