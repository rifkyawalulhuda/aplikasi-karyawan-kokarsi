-- CreateTable
CREATE TABLE IF NOT EXISTS "departments" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "departments_name_key" ON "departments"("name");
