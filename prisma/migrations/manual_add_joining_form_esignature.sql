-- Add e-signature fields to users table
ALTER TABLE "users1" ADD COLUMN "joining_form_signed_at" TIMESTAMP(3);
ALTER TABLE "users1" ADD COLUMN "joining_form_signed_by" TEXT;
ALTER TABLE "users1" ADD COLUMN "joining_form_signature" TEXT;
ALTER TABLE "users1" ADD COLUMN "joining_form_agreement" BOOLEAN NOT NULL DEFAULT false; 