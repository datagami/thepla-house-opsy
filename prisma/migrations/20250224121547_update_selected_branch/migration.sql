-- AlterTable
ALTER TABLE "users" ADD COLUMN     "selected_branch_id" TEXT;

-- CreateIndex
CREATE INDEX "users_selected_branch_id_idx" ON "users"("selected_branch_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_selected_branch_id_fkey" FOREIGN KEY ("selected_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
