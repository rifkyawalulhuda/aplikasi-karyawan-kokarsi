-- CreateTable
CREATE TABLE "contract_types" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "contract_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contract_types_name_key" ON "contract_types"("name");

-- Seed lookup from legacy contract types
INSERT INTO "contract_types" ("name")
SELECT DISTINCT "contractType"
FROM "contracts"
WHERE "contractType" IS NOT NULL
  AND "contractType" <> '';

-- Add new relation column
ALTER TABLE "contracts" ADD COLUMN "contractTypeId" INTEGER;

UPDATE "contracts" c
SET "contractTypeId" = ct.id
FROM "contract_types" ct
WHERE c."contractType" = ct.name;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_contractTypeId_fkey"
FOREIGN KEY ("contractTypeId") REFERENCES "contract_types"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop legacy text field after migration
ALTER TABLE "contracts" DROP COLUMN "contractType";
