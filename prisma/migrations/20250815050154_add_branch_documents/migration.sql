-- CreateTable
CREATE TABLE "branch_documents" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_type" TEXT NOT NULL,
    "renewal_date" TIMESTAMP(3) NOT NULL,
    "reminder_date" TIMESTAMP(3) NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_documents_branch_id_idx" ON "branch_documents"("branch_id");

-- CreateIndex
CREATE INDEX "branch_documents_uploaded_by_id_idx" ON "branch_documents"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "branch_documents_renewal_date_idx" ON "branch_documents"("renewal_date");

-- CreateIndex
CREATE INDEX "branch_documents_reminder_date_idx" ON "branch_documents"("reminder_date");

-- AddForeignKey
ALTER TABLE "branch_documents" ADD CONSTRAINT "branch_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_documents" ADD CONSTRAINT "branch_documents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
