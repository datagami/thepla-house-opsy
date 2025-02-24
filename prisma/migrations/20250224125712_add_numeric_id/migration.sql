-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "num_id" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "num_id" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "num_id" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "leave_requests" ADD COLUMN     "num_id" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "num_id" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "num_id" SERIAL NOT NULL;

-- AlterTable
ALTER TABLE "verification_tokens" ADD COLUMN     "num_id" SERIAL NOT NULL;
