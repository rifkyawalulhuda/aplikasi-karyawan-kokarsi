-- CreateTable
CREATE TABLE "banks" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "branch" VARCHAR(255),

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "employees" ADD COLUMN "bankId" INTEGER;
ALTER TABLE "employees" ADD COLUMN "bankAccountNumber" VARCHAR(50);

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "banks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
