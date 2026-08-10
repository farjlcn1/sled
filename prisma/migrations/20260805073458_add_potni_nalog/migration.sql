-- CreateEnum
CREATE TYPE "PotniNalogStatus" AS ENUM ('ODREJEN', 'V_TEKU', 'ZAKLJUCEN', 'LIKVIDIRAN');

-- CreateTable
CREATE TABLE "potni_nalogi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "status" "PotniNalogStatus" NOT NULL DEFAULT 'ODREJEN',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedByName" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "plannedFrom" TEXT NOT NULL,
    "plannedTo" TEXT NOT NULL,
    "plannedVia" TEXT,
    "plannedDepartureAt" TIMESTAMP(3) NOT NULL,
    "plannedReturnAt" TIMESTAMP(3) NOT NULL,
    "actualDepartureAt" TIMESTAMP(3),
    "actualReturnAt" TIMESTAMP(3),
    "startOdometerKm" DOUBLE PRECISION,
    "endOdometerKm" DOUBLE PRECISION,
    "actualDistanceKm" DOUBLE PRECISION,
    "dailyAllowanceEur" DOUBLE PRECISION,
    "otherCostsEur" DOUBLE PRECISION,
    "otherCostsNote" TEXT,
    "driverSignedAt" TIMESTAMP(3),
    "approverSignedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "potni_nalogi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "potni_nalogi_tenantId_number_key" ON "potni_nalogi"("tenantId", "number");

-- AddForeignKey
ALTER TABLE "potni_nalogi" ADD CONSTRAINT "potni_nalogi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potni_nalogi" ADD CONSTRAINT "potni_nalogi_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "potni_nalogi" ADD CONSTRAINT "potni_nalogi_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
