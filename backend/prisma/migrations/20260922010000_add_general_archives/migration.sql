CREATE TABLE "general_archives" (
    "id" SERIAL NOT NULL,
    "documentName" VARCHAR(255) NOT NULL,
    "documentNumber" VARCHAR(100),
    "createdDate" DATE,
    "expiryDate" DATE,
    "notes" TEXT,
    "fileUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "general_archives_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "general_archives_createdDate_idx" ON "general_archives"("createdDate");
CREATE INDEX "general_archives_expiryDate_idx" ON "general_archives"("expiryDate");

ALTER TYPE "NotificationCategory" ADD VALUE 'ARSIP_UMUM';
