-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- AlterTable
ALTER TABLE "users1" ADD COLUMN "department_id" TEXT;

-- CreateIndex
CREATE INDEX "users1_department_id_idx" ON "users1"("department_id");

-- AddForeignKey
ALTER TABLE "users1" ADD CONSTRAINT "users1_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
