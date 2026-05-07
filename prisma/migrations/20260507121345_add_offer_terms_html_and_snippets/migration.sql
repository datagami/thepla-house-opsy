-- CreateEnum
CREATE TYPE "OfferLetterSnippetCategory" AS ENUM ('WORKING_HOURS', 'PROBATION', 'LEAVE', 'NOTICE', 'DOCUMENTS', 'CONFIDENTIALITY', 'OTHER');

-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN     "terms_html" TEXT;

-- CreateTable
CREATE TABLE "offer_letter_snippets" (
    "id" TEXT NOT NULL,
    "num_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "category" "OfferLetterSnippetCategory" NOT NULL DEFAULT 'OTHER',
    "html_body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_letter_snippets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offer_letter_snippets_is_active_sort_order_idx" ON "offer_letter_snippets"("is_active", "sort_order");

-- AddForeignKey
ALTER TABLE "offer_letter_snippets" ADD CONSTRAINT "offer_letter_snippets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_letter_snippets" ADD CONSTRAINT "offer_letter_snippets_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users1"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill termsHtml for existing offers using legacy halfDays/weekOff.
-- Uses the same semantic <h3> / <ul> markup as the new seeded snippets so
-- existing offers render in the new design without surprises.
UPDATE "job_offers"
SET "terms_html" = CONCAT(
  '<h3><span class="num-mark">03</span>Working Hours &amp; Holidays</h3>',
  '<p>You will not be eligible for National Public Holidays. ',
  'However, you will be eligible for ', "week_off", ' week off',
  CASE WHEN "week_off" = 1 THEN '' ELSE 's' END,
  ' and ', "half_days", ' half day',
  CASE WHEN "half_days" = 1 THEN '' ELSE 's' END,
  ' in a month.</p>'
)
WHERE "terms_html" IS NULL;
