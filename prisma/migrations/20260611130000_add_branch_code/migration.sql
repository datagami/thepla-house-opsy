ALTER TABLE "branches" ADD COLUMN "code" TEXT;
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");
