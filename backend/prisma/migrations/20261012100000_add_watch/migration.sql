-- CreateEnum
CREATE TYPE "WatchKind" AS ENUM ('SITE', 'FORUM');

-- CreateEnum
CREATE TYPE "WatchMode" AS ENUM ('AREA', 'FEED');

-- CreateEnum
CREATE TYPE "WatchStatus" AS ENUM ('PENDING', 'OK', 'ERROR');

-- CreateEnum
CREATE TYPE "WatchItemKind" AS ENUM ('NEW', 'UPDATED');

-- CreateTable
CREATE TABLE "WatchSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookmarkId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "WatchKind" NOT NULL DEFAULT 'SITE',
    "mode" "WatchMode" NOT NULL DEFAULT 'AREA',
    "selector" TEXT,
    "feedUrl" TEXT,
    "filter" TEXT NOT NULL DEFAULT '',
    "intervalMinutes" INTEGER NOT NULL DEFAULT 360,
    "currentIntervalMinutes" INTEGER NOT NULL DEFAULT 360,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" "WatchStatus" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatchSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "kind" "WatchItemKind" NOT NULL DEFAULT 'NEW',
    "matchedTerms" TEXT[],
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "savedBookmarkId" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchCheck" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "newItems" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "WatchCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatchSource_isActive_nextCheckAt_idx" ON "WatchSource"("isActive", "nextCheckAt");

-- CreateIndex
CREATE INDEX "WatchSource_userId_idx" ON "WatchSource"("userId");

-- CreateIndex
CREATE INDEX "WatchItem_userId_isRead_firstSeenAt_idx" ON "WatchItem"("userId", "isRead", "firstSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "WatchItem_sourceId_key_key" ON "WatchItem"("sourceId", "key");

-- CreateIndex
CREATE INDEX "WatchCheck_sourceId_startedAt_idx" ON "WatchCheck"("sourceId", "startedAt");

-- AddForeignKey
ALTER TABLE "WatchSource" ADD CONSTRAINT "WatchSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchSource" ADD CONSTRAINT "WatchSource_bookmarkId_fkey" FOREIGN KEY ("bookmarkId") REFERENCES "Bookmark"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchItem" ADD CONSTRAINT "WatchItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "WatchSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchItem" ADD CONSTRAINT "WatchItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchCheck" ADD CONSTRAINT "WatchCheck_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "WatchSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

