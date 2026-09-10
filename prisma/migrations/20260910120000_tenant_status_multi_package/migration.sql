-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('AKTIVEN', 'NEAKTIVEN', 'TEST', 'V_ODPOVEDI');

-- AlterTable: dodaj status, prevedi obstoječi isActive vanj, nato isActive odstrani.
ALTER TABLE "tenants" ADD COLUMN     "status" "TenantStatus" NOT NULL DEFAULT 'AKTIVEN';
UPDATE "tenants" SET "status" = 'NEAKTIVEN' WHERE "isActive" = false;
ALTER TABLE "tenants" DROP COLUMN "isActive";

-- AlterTable: paket ne določa več meje naprav podjetja (podjetje ima lahko več paketov hkrati).
ALTER TABLE "subscription_plans" DROP COLUMN "deviceLimit";

-- AlterTable: eno podjetje lahko ima več paketov hkrati -- odstrani unique na tenantId samem,
-- dodaj unique na (tenantId, planId), da prepreči podvojeno naročnino na isti paket.
DROP INDEX "subscriptions_tenantId_key";
CREATE UNIQUE INDEX "subscriptions_tenantId_planId_key" ON "subscriptions"("tenantId", "planId");
