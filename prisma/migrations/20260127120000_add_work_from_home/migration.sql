-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "is_work_from_home" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users1" ADD COLUMN     "has_work_from_home" BOOLEAN NOT NULL DEFAULT false;
