-- AlterTable: izinkan penerima email tanpa akun user (email manual)
ALTER TABLE "email_notification_recipients" ALTER COLUMN "userAccountId" DROP NOT NULL;
ALTER TABLE "email_notification_recipients" ADD COLUMN "email" VARCHAR(255);
ALTER TABLE "email_notification_recipients" ADD COLUMN "name" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "email_notification_recipients_email_key" ON "email_notification_recipients"("email");
