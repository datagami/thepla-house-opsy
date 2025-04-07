-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('EMPLOYEE', 'BRANCH_MANAGER', 'HR', 'MANAGEMENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LeaveType" AS ENUM ('CASUAL', 'SICK', 'ANNUAL', 'UNPAID', 'OTHER');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDING_VERIFICATION', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SalaryStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "AdvanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SETTLED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users1" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "image" TEXT,
    "branch_id" TEXT,
    "managed_branch_id" TEXT,
    "selected_branch_id" TEXT,
    "approved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "doj" TIMESTAMP(3),
    "department" TEXT,
    "mobileNo" TEXT,
    "dob" TIMESTAMP(3),
    "gender" TEXT,
    "panNo" TEXT,
    "aadharNo" TEXT,
    "salary" DOUBLE PRECISION,
    "total_advance_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_emi_deduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankAccountNo" TEXT,
    "bankIfscCode" TEXT,

    CONSTRAINT "users1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "num_id" SERIAL NOT NULL
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "is_present" BOOLEAN NOT NULL DEFAULT false,
    "check_in" TEXT,
    "check_out" TEXT,
    "is_half_day" BOOLEAN NOT NULL DEFAULT false,
    "overtime" BOOLEAN NOT NULL DEFAULT false,
    "shift_1" BOOLEAN NOT NULL DEFAULT false,
    "shift_2" BOOLEAN NOT NULL DEFAULT false,
    "shift_3" BOOLEAN NOT NULL DEFAULT false,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verified_by_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "verification_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "leaveType" "LeaveType" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Salary" (
    "id" TEXT NOT NULL,
    "numId" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "advanceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeBonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherBonuses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL,
    "presentDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeDays" INTEGER NOT NULL DEFAULT 0,
    "halfDays" INTEGER NOT NULL DEFAULT 0,
    "leavesEarned" INTEGER NOT NULL DEFAULT 0,
    "leaveSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Salary_pkey" PRIMARY KEY ("id")
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
    "salary_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_paid" DOUBLE PRECISION NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "advance_payment_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "users1_email_key" ON "users1"("email");

-- CreateIndex
CREATE INDEX "users1_branch_id_idx" ON "users1"("branch_id");

-- CreateIndex
CREATE INDEX "users1_managed_branch_id_idx" ON "users1"("managed_branch_id");

-- CreateIndex
CREATE INDEX "users1_selected_branch_id_idx" ON "users1"("selected_branch_id");

-- CreateIndex
CREATE INDEX "users1_approved_by_id_idx" ON "users1"("approved_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "branches_name_key" ON "branches"("name");

-- CreateIndex
CREATE INDEX "attendance_verified_by_id_idx" ON "attendance"("verified_by_id");

-- CreateIndex
CREATE INDEX "attendance_branchId_idx" ON "attendance"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_id_date_key" ON "attendance"("id", "date");

-- CreateIndex
CREATE INDEX "Reference_userId_idx" ON "Reference"("userId");

-- CreateIndex
CREATE INDEX "Salary_userId_idx" ON "Salary"("userId");

-- CreateIndex
CREATE INDEX "Salary_month_year_idx" ON "Salary"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Salary_userId_month_year_key" ON "Salary"("userId", "month", "year");

-- CreateIndex
CREATE INDEX "advance_payments_user_id_idx" ON "advance_payments"("user_id");

-- CreateIndex
CREATE INDEX "advance_payments_approved_by_id_idx" ON "advance_payments"("approved_by_id");

-- CreateIndex
CREATE INDEX "advance_payment_installments_advance_id_idx" ON "advance_payment_installments"("advance_id");

-- CreateIndex
CREATE INDEX "advance_payment_installments_salary_id_idx" ON "advance_payment_installments"("salary_id");

-- CreateIndex
CREATE INDEX "advance_payment_installments_approved_by_id_idx" ON "advance_payment_installments"("approved_by_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users1" ADD CONSTRAINT "users1_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users1" ADD CONSTRAINT "users1_managed_branch_id_fkey" FOREIGN KEY ("managed_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users1" ADD CONSTRAINT "users1_selected_branch_id_fkey" FOREIGN KEY ("selected_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users1" ADD CONSTRAINT "users1_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salary" ADD CONSTRAINT "Salary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payments" ADD CONSTRAINT "advance_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payments" ADD CONSTRAINT "advance_payments_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payment_installments" ADD CONSTRAINT "advance_payment_installments_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "advance_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payment_installments" ADD CONSTRAINT "advance_payment_installments_salary_id_fkey" FOREIGN KEY ("salary_id") REFERENCES "Salary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_payment_installments" ADD CONSTRAINT "advance_payment_installments_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;
