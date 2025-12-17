-- CreateEnum
CREATE TYPE "JobOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'JOB_OFFER';

-- CreateTable
CREATE TABLE "job_offers" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "department_id" TEXT,
    "total_salary" DOUBLE PRECISION NOT NULL,
    "basic_per_annum" DOUBLE PRECISION NOT NULL,
    "basic_per_month" DOUBLE PRECISION NOT NULL,
    "other_allowances_per_annum" DOUBLE PRECISION NOT NULL,
    "other_allowances_per_month" DOUBLE PRECISION NOT NULL,
    "subtotal_per_annum" DOUBLE PRECISION NOT NULL,
    "subtotal_per_month" DOUBLE PRECISION NOT NULL,
    "offer_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joining_date" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "status" "JobOfferStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_offers_user_id_key" ON "job_offers"("user_id");

-- CreateIndex
CREATE INDEX "job_offers_user_id_idx" ON "job_offers"("user_id");

-- CreateIndex
CREATE INDEX "job_offers_department_id_idx" ON "job_offers"("department_id");

-- CreateIndex
CREATE INDEX "job_offers_status_idx" ON "job_offers"("status");

-- CreateIndex
CREATE INDEX "job_offers_offer_date_idx" ON "job_offers"("offer_date");

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_offers" ADD CONSTRAINT "job_offers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
