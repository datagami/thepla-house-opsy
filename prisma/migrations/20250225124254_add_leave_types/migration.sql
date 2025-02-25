/*
  Warnings:

  - Added the required column `leaveType` to the `leave_requests` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'ANNUAL', 'UNPAID', 'OTHER');

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "leaveType" "LeaveType" NOT NULL;
