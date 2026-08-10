-- AlterTable
ALTER TABLE "devices" ADD COLUMN "traccarDeviceId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "devices_traccarDeviceId_key" ON "devices"("traccarDeviceId");
