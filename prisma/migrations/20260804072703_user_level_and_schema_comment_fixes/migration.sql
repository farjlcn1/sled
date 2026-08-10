-- CreateEnum
CREATE TYPE "UserLevel" AS ENUM ('SUDO', 'UP', 'U', 'DEMO');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "level" "UserLevel" NOT NULL DEFAULT 'U';

-- Backfill: obstoječi uporabniki dobijo pravi nivo glede na svoje trenutne pravice
-- (novo dodano polje se privzeto nastavi na 'U', kar bi bilo napačno za obstoječe admine).
UPDATE "users" SET "level" = 'SUDO' WHERE "canManagePlatform" = true;
UPDATE "users" SET "level" = 'UP' WHERE "canManagePlatform" = false AND "canManageUsers" = true;
