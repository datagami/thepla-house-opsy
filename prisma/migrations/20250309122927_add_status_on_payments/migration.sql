-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- AlterTable
ALTER TABLE "advance_payment_installments" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "paid_at" DROP NOT NULL,
ALTER COLUMN "paid_at" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "advance_payment_installments_approved_by_id_idx" ON "advance_payment_installments"("approved_by_id");

-- AddForeignKey
ALTER TABLE "advance_payment_installments" ADD CONSTRAINT "advance_payment_installments_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;
