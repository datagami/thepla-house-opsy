-- CreateEnum
CREATE TYPE "SalaryStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SETTLED');

-- AlterTable
ALTER TABLE "users1" ADD COLUMN     "total_advance_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "total_emi_deduction" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "salaries" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "base_salary" DOUBLE PRECISION NOT NULL,
    "advance_deduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonuses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_salary" DOUBLE PRECISION NOT NULL,
    "status" "SalaryStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_payments" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "emi_amount" DOUBLE PRECISION NOT NULL,
    "remaining_amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" "AdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "is_settled" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advance_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_payment_installments" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "advance_id" TEXT NOT NULL,
    "salary_id" TEXT,
    "user_id" TEXT NOT NULL,
    "amount_paid" DOUBLE PRECISION NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "advance_payment_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salaries_user_id_idx" ON "salaries"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "salaries_user_id_month_year_key" ON "salaries"("user_id", "month", "year");

-- CreateIndex
CREATE INDEX "advance_payments_user_id_idx" ON "advance_payments"("user_id");

-- CreateIndex
CREATE INDEX "advance_payments_approved_by_id_idx" ON "advance_payments"("approved_by_id");

-- CreateIndex
CREATE INDEX "advance_payment_installments_advance_id_idx" ON "advance_payment_installments"("advance_id");

-- CreateIndex
CREATE INDEX "advance_payment_installments_salary_id_idx" ON "advance_payment_installments"("salary_id");

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payments" ADD CONSTRAINT "advance_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payments" ADD CONSTRAINT "advance_payments_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payment_installments" ADD CONSTRAINT "advance_payment_installments_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "advance_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payment_installments" ADD CONSTRAINT "advance_payment_installments_salary_id_fkey" FOREIGN KEY ("salary_id") REFERENCES "salaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
