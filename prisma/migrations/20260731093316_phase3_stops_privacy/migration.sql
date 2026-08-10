-- CreateEnum
CREATE TYPE "PrivacyRetentionTier" AS ENUM ('BASIC', 'WITH_MILEAGE');

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "minMovingSpeedKmh" DOUBLE PRECISION NOT NULL DEFAULT 5,
ADD COLUMN     "minStopDurationMin" INTEGER NOT NULL DEFAULT 5;

-- CreateTable
CREATE TABLE "vehicle_privacy_periods" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "retentionTier" "PrivacyRetentionTier" NOT NULL,

    CONSTRAINT "vehicle_privacy_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_privacy_periods_vehicleId_startedAt_idx" ON "vehicle_privacy_periods"("vehicleId", "startedAt");

-- AddForeignKey
ALTER TABLE "vehicle_privacy_periods" ADD CONSTRAINT "vehicle_privacy_periods_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
