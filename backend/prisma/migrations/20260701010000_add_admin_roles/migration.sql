-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'PENGELOLA_KOPERASI');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "master_admin"
ADD COLUMN IF NOT EXISTS "role" "AdminRole" NOT NULL DEFAULT 'ADMIN';

UPDATE "master_admin"
SET "role" = 'ADMIN'
WHERE "role" IS NULL;
