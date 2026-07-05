CREATE TABLE IF NOT EXISTS "app_settings" (
  "id" SERIAL NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_settings_key_key" ON "app_settings"("key");

INSERT INTO "app_settings" ("key", "value")
VALUES ('cooperativeChairmanName', 'Hari Suhono')
ON CONFLICT ("key") DO NOTHING;
