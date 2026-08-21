-- AlterTable
ALTER TABLE "users" ADD COLUMN     "visibleTabs" TEXT[] DEFAULT ARRAY[]::TEXT[];
