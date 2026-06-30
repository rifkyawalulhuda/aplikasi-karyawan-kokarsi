-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('MITRA', 'KONTRAK');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('SMA', 'D3', 'S1', 'S2');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('AKTIF', 'AKAN_HABIS', 'EXPIRED', 'DIBATALKAN');

-- CreateTable
CREATE TABLE "work_locations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "work_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_status" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "tax_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_levels" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "job_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "employeeNo" VARCHAR(100) NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "employmentStatus" "EmploymentStatus" NOT NULL,
    "taxStatusId" INTEGER NOT NULL,
    "birthDate" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "workLocationId" INTEGER NOT NULL,
    "jobRoleId" INTEGER NOT NULL,
    "jobLevelId" INTEGER NOT NULL,
    "educationLevel" "EducationLevel" NOT NULL,
    "joinDate" DATE NOT NULL,
    "phoneNumber" VARCHAR(50),
    "email" VARCHAR(255) NOT NULL,
    "fotoKaryawan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_admin" (
    "id" SERIAL NOT NULL,
    "employeeNo" VARCHAR(100) NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,

    CONSTRAINT "master_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "contractNo" VARCHAR(100) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "contractType" VARCHAR(50),
    "status" "ContractStatus" NOT NULL DEFAULT 'AKTIF',
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_documents" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_status_history" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "oldStatus" VARCHAR(20) NOT NULL,
    "newStatus" VARCHAR(20) NOT NULL,
    "changedBy" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "employee_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeNo_key" ON "employees"("employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "master_admin_employeeNo_key" ON "master_admin"("employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contractNo_key" ON "contracts"("contractNo");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_taxStatusId_fkey" FOREIGN KEY ("taxStatusId") REFERENCES "tax_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_workLocationId_fkey" FOREIGN KEY ("workLocationId") REFERENCES "work_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_jobLevelId_fkey" FOREIGN KEY ("jobLevelId") REFERENCES "job_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_admin" ADD CONSTRAINT "master_admin_employeeNo_fkey" FOREIGN KEY ("employeeNo") REFERENCES "employees"("employeeNo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_documents" ADD CONSTRAINT "contract_documents_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "master_admin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
