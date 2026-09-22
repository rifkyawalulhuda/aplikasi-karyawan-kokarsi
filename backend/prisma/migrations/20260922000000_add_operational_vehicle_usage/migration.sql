CREATE TYPE "OperationalVehicleUsageStatus" AS ENUM ('BATAL');

CREATE TABLE "operational_vehicle_usages" (
    "id" SERIAL NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL,
    "vehicleNumber" VARCHAR(30) NOT NULL,
    "driver" VARCHAR(255) NOT NULL,
    "destination" VARCHAR(255) NOT NULL,
    "user" VARCHAR(255) NOT NULL,
    "requester" VARCHAR(255) NOT NULL,
    "status" "OperationalVehicleUsageStatus",
    "cancelledAt" TIMESTAMP(3),
    "cancelledByName" VARCHAR(255),
    "cancelledByRole" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByName" VARCHAR(255) NOT NULL,
    "createdByRole" VARCHAR(50) NOT NULL,

    CONSTRAINT "operational_vehicle_usages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operational_vehicle_usages_usedAt_idx" ON "operational_vehicle_usages"("usedAt");
CREATE INDEX "operational_vehicle_usages_status_idx" ON "operational_vehicle_usages"("status");
