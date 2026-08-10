-- CreateEnum
CREATE TYPE "VehicleIconType" AS ENUM ('CAR', 'VAN', 'TRUCK', 'EXCAVATOR', 'TRACTOR', 'MOTORCYCLE');

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "serialNumber" TEXT,
ADD COLUMN     "simNumber" TEXT;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "fuelTankVolumeL" DOUBLE PRECISION,
ADD COLUMN     "icon" "VehicleIconType" NOT NULL DEFAULT 'CAR';
