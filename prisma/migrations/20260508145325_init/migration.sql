-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "deviceId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("deviceId","ticker")
);

-- CreateTable
CREATE TABLE "PaperTrade" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "closedAt" TIMESTAMP(3),
    "exitPrice" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "PaperTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "targetPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredAt" TIMESTAMP(3),
    "email" TEXT,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MacroAlert" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "daysBeforeAlert" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredAt" TIMESTAMP(3),

    CONSTRAINT "MacroAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "targetPrice" DOUBLE PRECISION NOT NULL,
    "triggeredPrice" DOUBLE PRECISION NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "eventName" TEXT,
    "eventDate" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatchlistItem_deviceId_idx" ON "WatchlistItem"("deviceId");

-- CreateIndex
CREATE INDEX "PaperTrade_deviceId_idx" ON "PaperTrade"("deviceId");

-- CreateIndex
CREATE INDEX "PaperTrade_deviceId_closedAt_idx" ON "PaperTrade"("deviceId", "closedAt");

-- CreateIndex
CREATE INDEX "PriceAlert_deviceId_idx" ON "PriceAlert"("deviceId");

-- CreateIndex
CREATE INDEX "PriceAlert_deviceId_triggeredAt_idx" ON "PriceAlert"("deviceId", "triggeredAt");

-- CreateIndex
CREATE INDEX "MacroAlert_deviceId_idx" ON "MacroAlert"("deviceId");

-- CreateIndex
CREATE INDEX "Notification_deviceId_idx" ON "Notification"("deviceId");

-- CreateIndex
CREATE INDEX "Notification_deviceId_read_idx" ON "Notification"("deviceId", "read");

-- CreateIndex
CREATE INDEX "Notification_deviceId_triggeredAt_idx" ON "Notification"("deviceId", "triggeredAt");

-- AddForeignKey
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTrade" ADD CONSTRAINT "PaperTrade_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MacroAlert" ADD CONSTRAINT "MacroAlert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
