-- CreateTable
CREATE TABLE "SiteCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "cookieEnc" TEXT NOT NULL,
    "cookieNames" TEXT[],
    "userAgent" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteCredential_userId_domain_key" ON "SiteCredential"("userId", "domain");

-- AddForeignKey
ALTER TABLE "SiteCredential" ADD CONSTRAINT "SiteCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

