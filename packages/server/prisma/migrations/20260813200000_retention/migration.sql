-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "anonymizedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "conversationRetentionDays" INTEGER;

