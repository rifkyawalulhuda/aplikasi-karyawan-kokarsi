-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "userId" INTEGER;
ALTER TABLE "notifications" ADD COLUMN "userType" VARCHAR(20);

-- CreateIndex
CREATE INDEX "notifications_userId_userType_idx" ON "notifications"("userId", "userType");