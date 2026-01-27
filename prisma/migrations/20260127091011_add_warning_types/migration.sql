-- AlterTable
ALTER TABLE "warnings" ADD COLUMN     "warning_type_id" TEXT;

-- CreateTable
CREATE TABLE "warning_types" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warning_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warning_types_name_key" ON "warning_types"("name");

-- CreateIndex
CREATE INDEX "warnings_warning_type_id_idx" ON "warnings"("warning_type_id");

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_warning_type_id_fkey" FOREIGN KEY ("warning_type_id") REFERENCES "warning_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
