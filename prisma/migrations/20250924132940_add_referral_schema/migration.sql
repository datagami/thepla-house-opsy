-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "referred_user_id" TEXT NOT NULL,
    "bonusAmount" DOUBLE PRECISION NOT NULL DEFAULT 2000,
    "eligible_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "salary_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Referral_referrer_id_idx" ON "Referral"("referrer_id");

-- CreateIndex
CREATE INDEX "Referral_referred_user_id_idx" ON "Referral"("referred_user_id");

-- CreateIndex
CREATE INDEX "Referral_eligible_at_idx" ON "Referral"("eligible_at");

-- CreateIndex
CREATE INDEX "Referral_salary_id_idx" ON "Referral"("salary_id");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referrer_id_referred_user_id_key" ON "Referral"("referrer_id", "referred_user_id");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_salary_id_fkey" FOREIGN KEY ("salary_id") REFERENCES "Salary"("id") ON DELETE SET NULL ON UPDATE CASCADE;
