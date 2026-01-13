-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "is_weekly_off" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users1" ADD COLUMN     "has_weekly_off" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weekly_off_day" INTEGER,
ADD COLUMN     "weekly_off_type" TEXT;
