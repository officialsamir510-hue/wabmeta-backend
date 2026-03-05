/*
  Warnings:

  - A unique constraint covering the columns `[whatsappMessageId]` on the table `Message` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "MessageStatus" ADD VALUE 'QUEUED';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "mediaId" TEXT,
ADD COLUMN     "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "whatsappMessageId" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "featureCsvUpload" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "featureOverrideByAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "featureSimpleBulkUpload" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WhatsAppAccount" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "Message_whatsappMessageId_key" ON "Message"("whatsappMessageId");

-- CreateIndex
CREATE INDEX "Message_timestamp_idx" ON "Message"("timestamp");

-- CreateIndex
CREATE INDEX "Message_whatsappMessageId_idx" ON "Message"("whatsappMessageId");
