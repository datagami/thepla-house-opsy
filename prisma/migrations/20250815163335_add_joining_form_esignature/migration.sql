-- AlterTable
ALTER TABLE "users1" ADD COLUMN     "joining_form_agreement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joining_form_signature" TEXT,
ADD COLUMN     "joining_form_signed_at" TIMESTAMP(3),
ADD COLUMN     "joining_form_signed_by" TEXT;
