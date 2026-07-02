-- DropIndex
DROP INDEX "employees_departmentId_idx";

-- AlterTable
ALTER TABLE "employee_offboarding" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "employee_status_history" ALTER COLUMN "oldStatus" SET DATA TYPE VARCHAR(30),
ALTER COLUMN "newStatus" SET DATA TYPE VARCHAR(30);

-- CreateTable
CREATE TABLE "warning_letters" (
    "id" SERIAL NOT NULL,
    "letterNumber" VARCHAR(100) NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "violationType" TEXT[],
    "warningLevel" INTEGER NOT NULL,
    "letterDate" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "processedById" INTEGER NOT NULL,
    "processedByName" VARCHAR(255) NOT NULL,
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warning_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warning_letters_letterNumber_key" ON "warning_letters"("letterNumber");

-- AddForeignKey
ALTER TABLE "warning_letters" ADD CONSTRAINT "warning_letters_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
