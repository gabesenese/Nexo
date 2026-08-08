-- Add the opaque widget key (replaces the org slug as the public widget key).
-- Backfill existing organizations with a generated key before enforcing NOT NULL.
ALTER TABLE "Organization" ADD COLUMN "widgetKey" TEXT;

UPDATE "Organization"
SET "widgetKey" = 'wk_' || replace(gen_random_uuid()::text, '-', '')
WHERE "widgetKey" IS NULL;

ALTER TABLE "Organization" ALTER COLUMN "widgetKey" SET NOT NULL;

CREATE UNIQUE INDEX "Organization_widgetKey_key" ON "Organization"("widgetKey");
