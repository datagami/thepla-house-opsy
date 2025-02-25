/*
  Warnings:

  - A unique constraint covering the columns `[user_id,date]` on the table `attendance` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "attendance" ALTER COLUMN "check_in" SET DATA TYPE TEXT,
ALTER COLUMN "check_out" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "attendance_user_id_date_key" ON "attendance"("user_id", "date");
