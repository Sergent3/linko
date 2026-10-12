-- Colonne già presenti in schema.prisma ma mai migrate (introdotte con db push / schema non sincronizzato)
ALTER TABLE "Bookmark" ADD COLUMN IF NOT EXISTS "contentMarkdown" TEXT,
ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN NOT NULL DEFAULT false;
