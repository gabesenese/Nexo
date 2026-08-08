-- AlterEnum
ALTER TYPE "MessageRole" ADD VALUE 'agent';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "authorUserId" TEXT;
