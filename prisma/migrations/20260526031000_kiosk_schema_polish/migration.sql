-- DropForeignKey
ALTER TABLE "fingerprint_enrollments" DROP CONSTRAINT "fingerprint_enrollments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "punch_events" DROP CONSTRAINT "punch_events_user_id_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "kiosk_devices_name_branch_id_key" ON "kiosk_devices"("name", "branch_id");

-- CreateIndex
CREATE INDEX "users1_updated_at_idx" ON "users1"("updated_at");

-- AddForeignKey
ALTER TABLE "fingerprint_enrollments" ADD CONSTRAINT "fingerprint_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "punch_events" ADD CONSTRAINT "punch_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique index for global shifts (branch_id IS NULL).
-- Postgres treats NULLs as distinct in regular unique constraints, so the
-- @@unique([name, branchId]) above does not prevent duplicate global shifts.
CREATE UNIQUE INDEX "shifts_name_global_key" ON "shifts"("name") WHERE "branch_id" IS NULL;
