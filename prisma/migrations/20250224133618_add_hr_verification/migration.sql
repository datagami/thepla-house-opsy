/*
  Warnings:

  - You are about to drop the column `is_locked` on the `attendance` table. All the data in the column will be lost.
  - You are about to drop the column `is_verified` on the `attendance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "attendance" DROP COLUMN "is_locked",
DROP COLUMN "is_verified",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "verification_note" TEXT,
ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by_id" TEXT;

-- CreateIndex
CREATE INDEX "attendance_verified_by_id_idx" ON "attendance"("verified_by_id");

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
