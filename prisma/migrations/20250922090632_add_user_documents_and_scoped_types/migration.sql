-- CreateEnum
CREATE TYPE "DocumentScope" AS ENUM ('BRANCH', 'USER');

-- AlterTable
ALTER TABLE "document_types" ADD COLUMN     "scope" "DocumentScope" NOT NULL DEFAULT 'BRANCH';

-- CreateTable
CREATE TABLE "user_documents" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_type" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_type_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_documents_user_id_idx" ON "user_documents"("user_id");

-- CreateIndex
CREATE INDEX "user_documents_uploaded_by_id_idx" ON "user_documents"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "user_documents_document_type_id_idx" ON "user_documents"("document_type_id");

-- AddForeignKey
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_documents" ADD CONSTRAINT "user_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
