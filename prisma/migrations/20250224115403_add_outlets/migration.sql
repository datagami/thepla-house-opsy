/*
  Warnings:

  - You are about to drop the column `location` on the `branches` table. All the data in the column will be lost.
  - Added the required column `city` to the `branches` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `branches` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "branches" DROP COLUMN "location",
ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT NOT NULL,
ADD COLUMN     "state" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "managed_branch_id" TEXT;

-- CreateIndex
CREATE INDEX "users_branch_id_idx" ON "users"("branch_id");

-- CreateIndex
CREATE INDEX "users_managed_branch_id_idx" ON "users"("managed_branch_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managed_branch_id_fkey" FOREIGN KEY ("managed_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
