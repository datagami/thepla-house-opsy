-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('FIRE_SAFETY', 'REFRIGERATION', 'KITCHEN_EQUIPMENT', 'ELECTRICAL', 'PLUMBING', 'PEST_CONTROL', 'CLEANING', 'OTHER');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('REPAIR', 'SERVICE', 'AMC', 'INSPECTION', 'REPLACEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenanceRecordStatus" AS ENUM ('PENDING', 'DONE');

-- AlterEnum: add equipment activity types to ActivityType
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'EQUIPMENT_CREATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'EQUIPMENT_UPDATED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'EQUIPMENT_DELETED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'EQUIPMENT_MAINTENANCE_LOGGED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'EQUIPMENT_MAINTENANCE_ALERT';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'EQUIPMENT_SNOOZED';

-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL DEFAULT 'OTHER',
    "location" TEXT,
    "frequency_months" INTEGER,
    "reminder_lead_days" INTEGER NOT NULL DEFAULT 30,
    "next_due_date" TIMESTAMP(3),
    "last_service_date" TIMESTAMP(3),
    "snoozed_until" TIMESTAMP(3),
    "status" "EquipmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "branch_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "service_date" TIMESTAMP(3) NOT NULL,
    "maintenance_type" "MaintenanceType" NOT NULL DEFAULT 'SERVICE',
    "issue" TEXT,
    "vendor_name" TEXT,
    "vendor_contact" TEXT,
    "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "MaintenanceRecordStatus" NOT NULL DEFAULT 'DONE',
    "remarks" TEXT,
    "bill_url" TEXT,
    "photo_urls" TEXT[],
    "next_due_date" TIMESTAMP(3),
    "logged_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "equipment_branch_id_idx" ON "equipment"("branch_id");

-- CreateIndex
CREATE INDEX "equipment_category_idx" ON "equipment"("category");

-- CreateIndex
CREATE INDEX "equipment_status_idx" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "equipment_next_due_date_idx" ON "equipment"("next_due_date");

-- CreateIndex
CREATE INDEX "maintenance_records_equipment_id_idx" ON "maintenance_records"("equipment_id");

-- CreateIndex
CREATE INDEX "maintenance_records_branch_id_idx" ON "maintenance_records"("branch_id");

-- CreateIndex
CREATE INDEX "maintenance_records_service_date_idx" ON "maintenance_records"("service_date");

-- CreateIndex
CREATE INDEX "maintenance_records_maintenance_type_idx" ON "maintenance_records"("maintenance_type");

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_logged_by_id_fkey" FOREIGN KEY ("logged_by_id") REFERENCES "users1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
