-- AlterTable
ALTER TABLE "warnings"
ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archived_at" TIMESTAMP(3),
ADD COLUMN "archived_by_id" TEXT;

-- CreateIndex
CREATE INDEX "warnings_archived_by_id_idx" ON "warnings"("archived_by_id");

-- CreateIndex
CREATE INDEX "warnings_is_archived_idx" ON "warnings"("is_archived");

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

