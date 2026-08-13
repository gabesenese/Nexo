-- AlterTable
ALTER TABLE "Source" ADD COLUMN "pageCount" INTEGER;
ALTER TABLE "Source" ADD COLUMN "truncated" BOOLEAN NOT NULL DEFAULT false;
