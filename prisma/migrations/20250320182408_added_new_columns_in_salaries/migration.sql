/*
  Warnings:

  - You are about to drop the `salaries` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "advance_payment_installments" DROP CONSTRAINT "advance_payment_installments_salary_id_fkey";

-- DropForeignKey
ALTER TABLE "salaries" DROP CONSTRAINT "salaries_user_id_fkey";

-- DropTable
DROP TABLE "salaries";

-- CreateTable
CREATE TABLE "Salary" (
    "id" TEXT NOT NULL,
    "numId" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "advanceDeduction" DOUBLE PRECISION NOT NULL,
    "bonuses" DOUBLE PRECISION NOT NULL,
    "deductions" DOUBLE PRECISION NOT NULL,
    "netSalary" DOUBLE PRECISION NOT NULL,
    "presentDays" INTEGER NOT NULL DEFAULT 0,
    "overtimeDays" INTEGER NOT NULL DEFAULT 0,
    "halfDays" INTEGER NOT NULL DEFAULT 0,
    "leavesEarned" INTEGER NOT NULL DEFAULT 0,
    "leaveSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Salary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Salary_userId_idx" ON "Salary"("userId");

-- CreateIndex
CREATE INDEX "Salary_month_year_idx" ON "Salary"("month", "year");

-- AddForeignKey
ALTER TABLE "Salary" ADD CONSTRAINT "Salary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payment_installments" ADD CONSTRAINT "advance_payment_installments_salary_id_fkey" FOREIGN KEY ("salary_id") REFERENCES "Salary"("id") ON DELETE SET NULL ON UPDATE CASCADE;
