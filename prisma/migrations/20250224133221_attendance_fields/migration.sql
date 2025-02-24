/*
  Warnings:

  - The `overtime` column on the `attendance` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "shift_1" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shift_2" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shift_3" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "check_in" DROP NOT NULL,
DROP COLUMN "overtime",
ADD COLUMN     "overtime" BOOLEAN NOT NULL DEFAULT false;
