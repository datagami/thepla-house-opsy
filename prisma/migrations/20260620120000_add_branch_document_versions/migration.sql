-- AlterEnum: document update activity type
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DOCUMENT_UPDATED';

-- CreateTable
CREATE TABLE "branch_document_versions" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "document_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT,
    "file_size" INTEGER NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_pruned" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "renewal_date" TIMESTAMP(3) NOT NULL,
    "reminder_date" TIMESTAMP(3) NOT NULL,
    "document_type_id" TEXT,
    "changed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_document_versions_document_id_idx" ON "branch_document_versions"("document_id");

-- AddForeignKey
ALTER TABLE "branch_document_versions" ADD CONSTRAINT "branch_document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "branch_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_document_versions" ADD CONSTRAINT "branch_document_versions_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
