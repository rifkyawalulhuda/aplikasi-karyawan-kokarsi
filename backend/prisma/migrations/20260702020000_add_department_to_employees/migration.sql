-- AlterTable
ALTER TABLE "employees"
ADD COLUMN IF NOT EXISTS "departmentId" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "employees_departmentId_idx" ON "employees"("departmentId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "employees"
  ADD CONSTRAINT "employees_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
