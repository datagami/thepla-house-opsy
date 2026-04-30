-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'SALARY_APPRAISAL';
ALTER TYPE "ActivityType" ADD VALUE 'DAILY_ATTENDANCE_REPORT';

-- CreateTable
CREATE TABLE "salary_appraisals" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "previous_salary" DOUBLE PRECISION NOT NULL,
    "new_salary" DOUBLE PRECISION NOT NULL,
    "change_amount" DOUBLE PRECISION NOT NULL,
    "change_percentage" DOUBLE PRECISION NOT NULL,
    "effective_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_appraisals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salary_appraisals_user_id_idx" ON "salary_appraisals"("user_id");

-- CreateIndex
CREATE INDEX "salary_appraisals_changed_by_id_idx" ON "salary_appraisals"("changed_by_id");

-- AddForeignKey
ALTER TABLE "salary_appraisals" ADD CONSTRAINT "salary_appraisals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_appraisals" ADD CONSTRAINT "salary_appraisals_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;
