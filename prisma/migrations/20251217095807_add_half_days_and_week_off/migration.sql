-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN     "half_days" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "week_off" INTEGER NOT NULL DEFAULT 2;
