-- Cambi di dominio dei siti seguiti (proposte da applicare o ignorare)
CREATE TYPE "DomainMoveReason" AS ENUM ('REDIRECT', 'DNS', 'MANUAL');
CREATE TYPE "DomainMoveStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

CREATE TABLE "DomainMove" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "oldHost" TEXT NOT NULL,
    "newHost" TEXT NOT NULL,
    "reason" "DomainMoveReason" NOT NULL,
    "status" "DomainMoveStatus" NOT NULL DEFAULT 'PENDING',
    "evidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "DomainMove_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DomainMove_userId_oldHost_newHost_key" ON "DomainMove"("userId", "oldHost", "newHost");
CREATE INDEX "DomainMove_userId_status_idx" ON "DomainMove"("userId", "status");

ALTER TABLE "DomainMove" ADD CONSTRAINT "DomainMove_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
