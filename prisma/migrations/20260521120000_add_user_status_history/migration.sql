-- CreateTable
CREATE TABLE "user_status_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_status" "UserStatus",
    "to_status" "UserStatus" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by_id" TEXT,
    "reason" TEXT,

    CONSTRAINT "user_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_status_history_user_id_changed_at_idx" ON "user_status_history"("user_id", "changed_at");

-- AddForeignKey
ALTER TABLE "user_status_history" ADD CONSTRAINT "user_status_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_status_history" ADD CONSTRAINT "user_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;
