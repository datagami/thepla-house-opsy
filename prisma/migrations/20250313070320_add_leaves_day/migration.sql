/*
  Warnings:

  - Made the column `salary_id` on table `advance_payment_installments` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "advance_payment_installments" ALTER COLUMN "salary_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "salaries" ADD COLUMN     "leave_salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "leaves_earned" INTEGER NOT NULL DEFAULT 0;
