-- AlterTable
ALTER TABLE "vehicle_groups" ADD COLUMN     "isArchiveGroup" BOOLEAN NOT NULL DEFAULT false;

-- Zagotovi arhivsko skupino za vsakega ŽE OBSTOJEČEGA najemnika (novi jo dobijo prek
-- createTenant, glej app/(app)/admin/najemniki/actions.ts) -- brez tega "Arhiviraj" pri vozilih
-- obstoječih podjetij ne bi imel kam dodati vozila. Če najemnik že ima skupino z imenom "Arhiv"
-- (ročno ustvarjeno pred to funkcionalnostjo), jo raje posvoji kot arhivsko, namesto da bi trčil
-- ob @@unique([tenantId, name]).
INSERT INTO "vehicle_groups" ("id", "tenantId", "name", "isArchiveGroup", "createdAt")
SELECT gen_random_uuid()::text, "id", 'Arhiv', true, now()
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "vehicle_groups" g WHERE g."tenantId" = t."id" AND g."isArchiveGroup" = true
)
ON CONFLICT ("tenantId", "name") DO UPDATE SET "isArchiveGroup" = true;
