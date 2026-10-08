-- CreateEnum
CREATE TYPE "OrgPositionStatus" AS ENUM ('AKTIF', 'AKAN_BERAKHIR', 'EXPIRED', 'TIDAK_AKTIF');

-- CreateTable
CREATE TABLE "org_periods" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_positions" (
    "id" SERIAL NOT NULL,
    "periodId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "employeeId" INTEGER,
    "name" VARCHAR(255) NOT NULL,
    "position" VARCHAR(255) NOT NULL,
    "unitUsaha" VARCHAR(255),
    "photoUrl" VARCHAR(500),
    "skNumber" VARCHAR(255),
    "skDate" DATE,
    "startDate" DATE,
    "endDate" DATE,
    "status" "OrgPositionStatus" NOT NULL DEFAULT 'AKTIF',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "org_positions_periodId_idx" ON "org_positions"("periodId");

-- CreateIndex
CREATE INDEX "org_positions_parentId_idx" ON "org_positions"("parentId");

-- AddForeignKey
ALTER TABLE "org_positions" ADD CONSTRAINT "org_positions_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "org_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_positions" ADD CONSTRAINT "org_positions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "org_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_positions" ADD CONSTRAINT "org_positions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
