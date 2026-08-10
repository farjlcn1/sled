-- AlterTable
ALTER TABLE "users" ADD COLUMN     "visibleVehicleFields" TEXT[] DEFAULT ARRAY[]::TEXT[];
