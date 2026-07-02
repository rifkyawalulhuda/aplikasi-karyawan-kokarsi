CREATE TYPE "EmploymentStatus_new" AS ENUM ('AKTIF', 'KONTRAK_EXPIRED', 'RESIGN', 'PHK');

ALTER TABLE "employees"
ALTER COLUMN "employmentStatus" TYPE "EmploymentStatus_new"
USING (
  CASE
    WHEN "employmentStatus"::text IN ('MITRA', 'KONTRAK') THEN 'AKTIF'
    ELSE 'KONTRAK_EXPIRED'
  END
)::"EmploymentStatus_new";

ALTER TYPE "EmploymentStatus" RENAME TO "EmploymentStatus_old";
ALTER TYPE "EmploymentStatus_new" RENAME TO "EmploymentStatus";
DROP TYPE "EmploymentStatus_old";

ALTER TYPE "ContractStatus" ADD VALUE IF NOT EXISTS 'SELESAI';
CREATE TYPE "TerminationType" AS ENUM ('RESIGN', 'PHK');

ALTER TABLE "employee_status_history" DROP CONSTRAINT IF EXISTS "employee_status_history_changedBy_fkey";
ALTER TABLE "employee_status_history" ADD COLUMN "changedById" INTEGER;
ALTER TABLE "employee_status_history" ADD COLUMN "changedByName" VARCHAR(255);
ALTER TABLE "employee_status_history" ADD COLUMN "changedByRole" VARCHAR(50);

UPDATE "employee_status_history" AS history
SET
  "changedById" = history."changedBy",
  "changedByName" = COALESCE(admin."fullName", 'System'),
  "changedByRole" = COALESCE(admin."role"::text, 'ADMIN')
FROM "master_admin" AS admin
WHERE history."changedBy" = admin."id";

UPDATE "employee_status_history"
SET
  "changedByName" = COALESCE("changedByName", 'System'),
  "changedByRole" = COALESCE("changedByRole", 'ADMIN');

ALTER TABLE "employee_status_history" ALTER COLUMN "changedByName" SET NOT NULL;
ALTER TABLE "employee_status_history" ALTER COLUMN "changedByRole" SET NOT NULL;
ALTER TABLE "employee_status_history" DROP COLUMN "changedBy";

CREATE TABLE "employee_offboarding" (
  "id" SERIAL NOT NULL,
  "employeeId" INTEGER NOT NULL,
  "terminationType" "TerminationType" NOT NULL,
  "terminationDate" DATE NOT NULL,
  "reason" TEXT,
  "processedById" INTEGER NOT NULL,
  "processedByName" VARCHAR(255) NOT NULL,
  "processedByRole" VARCHAR(50) NOT NULL,
  "processedByKind" VARCHAR(50) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "employee_offboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_offboarding_employeeId_key" ON "employee_offboarding"("employeeId");

ALTER TABLE "employee_offboarding"
ADD CONSTRAINT "employee_offboarding_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
