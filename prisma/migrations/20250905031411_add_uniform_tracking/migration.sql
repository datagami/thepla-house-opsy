-- CreateEnum
CREATE TYPE "UniformStatus" AS ENUM ('ISSUED', 'RETURNED', 'LOST', 'DAMAGED');

-- CreateTable
CREATE TABLE "uniforms" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "size" TEXT,
    "uniform_number" TEXT,
    "color" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "UniformStatus" NOT NULL DEFAULT 'ISSUED',
    "issued_at" TIMESTAMP(3) NOT NULL,
    "returned_at" TIMESTAMP(3),
    "notes" TEXT,
    "issued_by_id" TEXT,
    "returned_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uniforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "uniforms_user_id_idx" ON "uniforms"("user_id");

-- CreateIndex
CREATE INDEX "uniforms_issued_by_id_idx" ON "uniforms"("issued_by_id");

-- CreateIndex
CREATE INDEX "uniforms_returned_by_id_idx" ON "uniforms"("returned_by_id");

-- CreateIndex
CREATE INDEX "uniforms_status_idx" ON "uniforms"("status");

-- CreateIndex
CREATE INDEX "uniforms_issued_at_idx" ON "uniforms"("issued_at");

-- AddForeignKey
ALTER TABLE "uniforms" ADD CONSTRAINT "uniforms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uniforms" ADD CONSTRAINT "uniforms_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uniforms" ADD CONSTRAINT "uniforms_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;
