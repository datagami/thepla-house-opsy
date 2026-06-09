-- Change default reminder lead time for equipment from 30 to 15 days.
ALTER TABLE "equipment" ALTER COLUMN "reminder_lead_days" SET DEFAULT 15;
