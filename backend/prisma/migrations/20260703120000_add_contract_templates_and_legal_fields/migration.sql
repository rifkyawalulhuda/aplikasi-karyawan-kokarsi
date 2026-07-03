DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContractFamily') THEN
    CREATE TYPE "ContractFamily" AS ENUM ('MITRA', 'PKWT');
  END IF;
END $$;

ALTER TABLE "employees"
  ADD COLUMN IF NOT EXISTS "nik" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "birthPlace" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "address" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'employees_nik_key'
  ) THEN
    CREATE UNIQUE INDEX "employees_nik_key" ON "employees"("nik");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "contract_templates" (
  "id" SERIAL NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "family" "ContractFamily" NOT NULL,
  "contractTypeId" INTEGER,
  "jobRoleId" INTEGER,
  "description" TEXT,
  "templateKey" VARCHAR(100) NOT NULL,
  "requiredFields" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'contract_templates_code_key'
  ) THEN
    CREATE UNIQUE INDEX "contract_templates_code_key" ON "contract_templates"("code");
  END IF;
END $$;

ALTER TABLE "contract_templates"
  DROP CONSTRAINT IF EXISTS "contract_templates_contractTypeId_fkey",
  ADD CONSTRAINT "contract_templates_contractTypeId_fkey"
    FOREIGN KEY ("contractTypeId") REFERENCES "contract_types"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contract_templates"
  DROP CONSTRAINT IF EXISTS "contract_templates_jobRoleId_fkey",
  ADD CONSTRAINT "contract_templates_jobRoleId_fkey"
    FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contracts"
  ADD COLUMN IF NOT EXISTS "templateId" INTEGER,
  ADD COLUMN IF NOT EXISTS "signedDate" DATE,
  ADD COLUMN IF NOT EXISTS "positionLabel" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "workLocationLabel" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "baseCompensation" INTEGER,
  ADD COLUMN IF NOT EXISTS "templateData" JSONB,
  ADD COLUMN IF NOT EXISTS "generatedDocxUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "generatedPdfUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "generatedAt" TIMESTAMP(3);

ALTER TABLE "contracts"
  DROP CONSTRAINT IF EXISTS "contracts_templateId_fkey",
  ADD CONSTRAINT "contracts_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "contract_templates"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
