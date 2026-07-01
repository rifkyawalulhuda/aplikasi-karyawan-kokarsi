-- CreateTable
CREATE TABLE IF NOT EXISTS "user_accounts" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "nik" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'PENGELOLA_KOPERASI',
    "username" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_accounts_nik_key" ON "user_accounts"("nik");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_accounts_email_key" ON "user_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_accounts_username_key" ON "user_accounts"("username");
