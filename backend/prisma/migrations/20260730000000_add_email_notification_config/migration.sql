-- CreateTable
CREATE TABLE "email_notification_recipients" (
    "id" SERIAL NOT NULL,
    "userAccountId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_notification_sent_log" (
    "id" SERIAL NOT NULL,
    "sourceType" VARCHAR(50) NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "triggerDay" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_notification_sent_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_notification_config_log" (
    "id" SERIAL NOT NULL,
    "changedBy" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_notification_config_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_notification_recipients_userAccountId_key" ON "email_notification_recipients"("userAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "email_notification_sent_log_sourceType_sourceId_triggerDay_key" ON "email_notification_sent_log"("sourceType", "sourceId", "triggerDay");

-- AddForeignKey
ALTER TABLE "email_notification_recipients" ADD CONSTRAINT "email_notification_recipients_userAccountId_fkey" FOREIGN KEY ("userAccountId") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
