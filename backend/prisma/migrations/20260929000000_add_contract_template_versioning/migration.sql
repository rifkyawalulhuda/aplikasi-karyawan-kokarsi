-- CreateEnum
CREATE TYPE "TemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TemplateFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MASTER_REFERENCE');

-- CreateEnum
CREATE TYPE "TemplateFieldSourceType" AS ENUM ('SYSTEM', 'CONTRACT_INPUT', 'MASTER_REFERENCE');

-- CreateTable
CREATE TABLE "contract_template_versions" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "contentDefinition" JSONB NOT NULL,
    "fieldDefinitions" JSONB NOT NULL,
    "changeSummary" TEXT,
    "createdByName" TEXT,
    "publishedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "contract_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_field_definitions" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(150) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "dataType" "TemplateFieldType" NOT NULL,
    "sourceType" "TemplateFieldSourceType" NOT NULL,
    "sourceConfig" JSONB,
    "options" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_template_fields" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "fieldId" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB,

    CONSTRAINT "contract_template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_template_versions_templateId_versionNumber_key" ON "contract_template_versions"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "contract_template_versions_templateId_idx" ON "contract_template_versions"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "template_field_definitions_key_key" ON "template_field_definitions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "contract_template_fields_templateId_fieldId_key" ON "contract_template_fields"("templateId", "fieldId");

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "templateVersionId" INTEGER;
ALTER TABLE "contracts" ADD COLUMN "templateSnapshot" JSONB;
ALTER TABLE "contracts" ADD COLUMN "resolvedTemplateData" JSONB;

-- AddForeignKey
ALTER TABLE "contract_template_versions" ADD CONSTRAINT "contract_template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "contract_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_template_fields" ADD CONSTRAINT "contract_template_fields_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "contract_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_template_fields" ADD CONSTRAINT "contract_template_fields_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "template_field_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "contract_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
