-- Categoria e ordine personalizzato delle fonti
ALTER TABLE "WatchSource" ADD COLUMN "category" TEXT;
ALTER TABLE "WatchSource" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Ordine iniziale: quello di creazione, per utente
UPDATE "WatchSource" s SET "position" = o.rn
FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "createdAt") - 1 AS rn FROM "WatchSource") o
WHERE s.id = o.id;
