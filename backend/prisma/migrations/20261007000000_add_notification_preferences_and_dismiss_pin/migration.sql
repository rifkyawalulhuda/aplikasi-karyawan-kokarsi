-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "pinnedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userType" VARCHAR(20) NOT NULL,
    "mutedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quietHoursStart" VARCHAR(5),
    "quietHoursEnd" VARCHAR(5),
    "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "osNotificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_userId_userType_dismissedAt_idx" ON "notifications"("userId", "userType", "dismissedAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_userType_key" ON "notification_preferences"("userId", "userType");
