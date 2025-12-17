-- AlterTable
ALTER TABLE "job_offers" ADD COLUMN     "salary_components" JSONB,
ALTER COLUMN "basic_per_annum" DROP NOT NULL,
ALTER COLUMN "basic_per_month" DROP NOT NULL,
ALTER COLUMN "other_allowances_per_annum" DROP NOT NULL,
ALTER COLUMN "other_allowances_per_month" DROP NOT NULL,
ALTER COLUMN "subtotal_per_annum" DROP NOT NULL,
ALTER COLUMN "subtotal_per_month" DROP NOT NULL;
