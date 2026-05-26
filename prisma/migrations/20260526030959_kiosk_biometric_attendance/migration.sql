-- CreateEnum
CREATE TYPE "PunchDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "PunchOutcome" AS ENUM ('RECORDED', 'BLOCKED_WRONG_OUTLET');

-- CreateEnum
CREATE TYPE "GroomingCheckStatus" AS ENUM ('PASS', 'FAIL', 'PENDING', 'ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'PUNCH_IN';
ALTER TYPE "ActivityType" ADD VALUE 'PUNCH_OUT';
ALTER TYPE "ActivityType" ADD VALUE 'PUNCH_BLOCKED_WRONG_OUTLET';
ALTER TYPE "ActivityType" ADD VALUE 'GROOMING_CHECK_FAILED';
ALTER TYPE "ActivityType" ADD VALUE 'FINGERPRINT_ENROLLED';
ALTER TYPE "ActivityType" ADD VALUE 'KIOSK_DEVICE_CREATED';

-- CreateTable
CREATE TABLE "kiosk_devices" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kiosk_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fingerprint_enrollments" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_data" TEXT NOT NULL,
    "finger_index" INTEGER NOT NULL,
    "enrolled_by_device_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fingerprint_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "branch_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_segments" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "punch_events" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "attendance_id" TEXT,
    "shift_id" TEXT,
    "kiosk_device_id" TEXT,
    "branch_id" TEXT NOT NULL,
    "assigned_branch_id" TEXT,
    "direction" "PunchDirection" NOT NULL,
    "punched_at" TIMESTAMP(3) NOT NULL,
    "outcome" "PunchOutcome" NOT NULL DEFAULT 'RECORDED',
    "uniform_photo_url" TEXT,
    "nails_photo_url" TEXT,
    "uniform_check_status" "GroomingCheckStatus",
    "nails_check_status" "GroomingCheckStatus",
    "uniform_check_reason" TEXT,
    "nails_check_reason" TEXT,
    "uniform_confidence" DOUBLE PRECISION,
    "nails_confidence" DOUBLE PRECISION,
    "ai_raw_response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "punch_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_devices_token_hash_key" ON "kiosk_devices"("token_hash");

-- CreateIndex
CREATE INDEX "kiosk_devices_branch_id_idx" ON "kiosk_devices"("branch_id");

-- CreateIndex
CREATE INDEX "kiosk_devices_is_active_idx" ON "kiosk_devices"("is_active");

-- CreateIndex
CREATE INDEX "fingerprint_enrollments_user_id_idx" ON "fingerprint_enrollments"("user_id");

-- CreateIndex
CREATE INDEX "fingerprint_enrollments_is_active_idx" ON "fingerprint_enrollments"("is_active");

-- CreateIndex
CREATE INDEX "fingerprint_enrollments_updated_at_idx" ON "fingerprint_enrollments"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "fingerprint_enrollments_user_id_finger_index_key" ON "fingerprint_enrollments"("user_id", "finger_index");

-- CreateIndex
CREATE INDEX "shifts_branch_id_idx" ON "shifts"("branch_id");

-- CreateIndex
CREATE INDEX "shifts_is_active_idx" ON "shifts"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_name_branch_id_key" ON "shifts"("name", "branch_id");

-- CreateIndex
CREATE INDEX "shift_segments_shift_id_idx" ON "shift_segments"("shift_id");

-- CreateIndex
CREATE INDEX "punch_events_user_id_punched_at_idx" ON "punch_events"("user_id", "punched_at");

-- CreateIndex
CREATE INDEX "punch_events_attendance_id_idx" ON "punch_events"("attendance_id");

-- CreateIndex
CREATE INDEX "punch_events_branch_id_idx" ON "punch_events"("branch_id");

-- CreateIndex
CREATE INDEX "punch_events_outcome_idx" ON "punch_events"("outcome");

-- CreateIndex
CREATE INDEX "punch_events_punched_at_idx" ON "punch_events"("punched_at");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_user_id_date_key" ON "attendance"("user_id", "date");

-- AddForeignKey
ALTER TABLE "kiosk_devices" ADD CONSTRAINT "kiosk_devices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fingerprint_enrollments" ADD CONSTRAINT "fingerprint_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fingerprint_enrollments" ADD CONSTRAINT "fingerprint_enrollments_enrolled_by_device_id_fkey" FOREIGN KEY ("enrolled_by_device_id") REFERENCES "kiosk_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_segments" ADD CONSTRAINT "shift_segments_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_attendance_id_fkey" FOREIGN KEY ("attendance_id") REFERENCES "attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_kiosk_device_id_fkey" FOREIGN KEY ("kiosk_device_id") REFERENCES "kiosk_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

