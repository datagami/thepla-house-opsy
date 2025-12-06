-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM (
    'USER_CREATED',
    'USER_UPDATED',
    'USER_DELETED',
    'USER_STATUS_CHANGED',
    'USER_ROLE_CHANGED',
    'USER_BRANCH_ASSIGNED',
    'USER_APPROVED',
    'ATTENDANCE_CREATED',
    'ATTENDANCE_UPDATED',
    'ATTENDANCE_VERIFIED',
    'ATTENDANCE_REJECTED',
    'LEAVE_REQUEST_CREATED',
    'LEAVE_REQUEST_APPROVED',
    'LEAVE_REQUEST_REJECTED',
    'SALARY_GENERATED',
    'SALARY_UPDATED',
    'SALARY_STATUS_CHANGED',
    'ADVANCE_PAYMENT_REQUESTED',
    'ADVANCE_PAYMENT_APPROVED',
    'ADVANCE_PAYMENT_REJECTED',
    'ADVANCE_PAYMENT_SETTLED',
    'INSTALLMENT_PAID',
    'UNIFORM_ISSUED',
    'UNIFORM_RETURNED',
    'DOCUMENT_UPLOADED',
    'DOCUMENT_DELETED',
    'BRANCH_CREATED',
    'BRANCH_UPDATED',
    'BRANCH_DELETED',
    'DEPARTMENT_CREATED',
    'DEPARTMENT_UPDATED',
    'DEPARTMENT_DELETED',
    'NOTE_CREATED',
    'NOTE_UPDATED',
    'NOTE_DELETED',
    'NOTE_SHARED',
    'NOTE_ARCHIVED',
    'LOGIN',
    'LOGOUT',
    'PASSWORD_CHANGED',
    'OTHER'
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "activity_type" "ActivityType" NOT NULL,
    "user_id" TEXT,
    "target_user_id" TEXT,
    "target_id" TEXT,
    "entity_type" TEXT,
    "description" TEXT NOT NULL,
    "metadata" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_target_user_id_idx" ON "activity_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "activity_logs_activity_type_idx" ON "activity_logs"("activity_type");

-- CreateIndex
CREATE INDEX "activity_logs_entity_type_idx" ON "activity_logs"("entity_type");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_target_id_idx" ON "activity_logs"("target_id");

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;
