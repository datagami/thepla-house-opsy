/*
  Warnings:

  - A unique constraint covering the columns `[id,date]` on the table `attendance` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "attendance_user_id_date_key";

-- CreateIndex
CREATE UNIQUE INDEX "attendance_id_date_key" ON "attendance"("id", "date");
