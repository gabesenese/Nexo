-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "lastReopenedAt" TIMESTAMP(3),
ADD COLUMN     "reopenCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resolvedAt" TIMESTAMP(3);
