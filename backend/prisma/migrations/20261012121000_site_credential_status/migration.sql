-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('UNVERIFIED', 'OK', 'EXPIRED');

-- AlterTable
ALTER TABLE "SiteCredential" ADD COLUMN     "expiredAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "status" "CredentialStatus" NOT NULL DEFAULT 'UNVERIFIED';

