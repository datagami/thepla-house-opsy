-- CreateTable
CREATE TABLE "warnings" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "reported_by_id" TEXT,
    "reason" TEXT NOT NULL,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warnings_user_id_idx" ON "warnings"("user_id");

-- CreateIndex
CREATE INDEX "warnings_reported_by_id_idx" ON "warnings"("reported_by_id");

-- CreateIndex
CREATE INDEX "warnings_created_at_idx" ON "warnings"("created_at");

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

