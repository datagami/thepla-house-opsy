/*
  Warnings:

  - A unique constraint covering the columns `[userId,month,year]` on the table `Salary` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Salary_userId_month_year_key" ON "Salary"("userId", "month", "year");
