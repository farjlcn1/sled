-- CreateTable
CREATE TABLE "vehicle_reservations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "routeName" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_reservations_tenantId_startAt_idx" ON "vehicle_reservations"("tenantId", "startAt");

-- CreateIndex
CREATE INDEX "vehicle_reservations_vehicleId_startAt_idx" ON "vehicle_reservations"("vehicleId", "startAt");

-- AddForeignKey
ALTER TABLE "vehicle_reservations" ADD CONSTRAINT "vehicle_reservations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_reservations" ADD CONSTRAINT "vehicle_reservations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_reservations" ADD CONSTRAINT "vehicle_reservations_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
