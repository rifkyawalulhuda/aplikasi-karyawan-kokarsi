-- AlterTable: Add memberNo column to employees
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "memberNo" VARCHAR(100);
