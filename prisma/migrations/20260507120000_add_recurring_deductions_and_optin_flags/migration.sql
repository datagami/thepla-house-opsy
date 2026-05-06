-- Per-employee statutory opt-in flags
ALTER TABLE "users1"
  ADD COLUMN "opt_in_pt"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "opt_in_pf"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "opt_in_esi" BOOLEAN NOT NULL DEFAULT false;

-- Snapshot of recurring deductions applied to a salary
ALTER TABLE "Salary"
  ADD COLUMN "recurring_deductions" JSONB;
