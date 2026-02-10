-- AlterEnum
ALTER TYPE "ActivityType" ADD VALUE 'REFERRAL_ARCHIVED';

-- AlterTable
ALTER TABLE "Referral" ADD COLUMN     "archived_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Referral_archived_at_idx" ON "Referral"("archived_at");
