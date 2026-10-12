-- Consegna delle novità per fonte e impostazioni delle notifiche
CREATE TYPE "WatchDelivery" AS ENUM ('NORMAL', 'INSTANT', 'DIGEST');
ALTER TABLE "WatchSource" ADD COLUMN "delivery" "WatchDelivery" NOT NULL DEFAULT 'NORMAL';

CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramTokenEnc" TEXT,
    "telegramBot" TEXT,
    "telegramChatId" TEXT,
    "keywords" TEXT NOT NULL DEFAULT '',
    "digestHour" INTEGER NOT NULL DEFAULT 8,
    "lastDigestAt" TIMESTAMP(3),
    "nextDigestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NotificationSettings_userId_key" ON "NotificationSettings"("userId");
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
