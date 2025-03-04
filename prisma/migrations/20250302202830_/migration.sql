/*
  Warnings:

  - The `status` column on the `attendance` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDING_VERIFICATION', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "attendance" DROP COLUMN "status",
ADD COLUMN     "status" "AttendanceStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION';
