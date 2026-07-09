-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('KONTRAK_KARYAWAN', 'SERTIFIKASI_IJIN', 'KONTRAK_VENDOR', 'LEGAL_KOPERASI');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "severity" "NotificationSeverity" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "sourceType" VARCHAR(50) NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "triggerDay" INTEGER NOT NULL,
    "deeplink" VARCHAR(255) NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "expiryDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_sourceType_sourceId_triggerDay_key" ON "notifications"("sourceType", "sourceId", "triggerDay");

-- CreateIndex
CREATE INDEX "notifications_isRead_resolvedAt_idx" ON "notifications"("isRead", "resolvedAt");
