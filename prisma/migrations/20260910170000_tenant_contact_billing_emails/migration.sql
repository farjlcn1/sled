ALTER TABLE "tenants" ADD COLUMN "contactPerson" TEXT;
ALTER TABLE "tenants" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "tenants" ADD COLUMN "billingEmails" TEXT[] NOT NULL DEFAULT '{}';

-- Prenesi obstoječi posamezni e-poštni naslov v nov seznam (podjetje lahko odslej doda še dodatne).
UPDATE "tenants" SET "billingEmails" = ARRAY["billingEmail"] WHERE "billingEmail" IS NOT NULL AND "billingEmail" != '';

ALTER TABLE "tenants" DROP COLUMN "billingEmail";
