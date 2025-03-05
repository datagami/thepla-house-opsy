-- AlterTable
ALTER TABLE "users1" ADD COLUMN     "aadharNo" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "doj" TIMESTAMP(3),
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "mobileNo" TEXT,
ADD COLUMN     "panNo" TEXT,
ADD COLUMN     "salary" DOUBLE PRECISION,
ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reference_userId_idx" ON "Reference"("userId");

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users1"("id") ON DELETE CASCADE ON UPDATE CASCADE;
