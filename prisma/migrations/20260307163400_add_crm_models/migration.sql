-- ============================================
-- Migration: add_crm_models
-- Created:   2026-03-07
-- Safe:      Additive only (new tables, enums, indexes, relations)
-- ============================================

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'TASK', 'STAGE_CHANGE', 'STATUS_CHANGE');

-- CreateTable: Pipeline
CREATE TABLE "Pipeline" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "description"    TEXT,
    "isDefault"      BOOLEAN NOT NULL DEFAULT false,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PipelineStage
CREATE TABLE "PipelineStage" (
    "id"          TEXT NOT NULL,
    "pipelineId"  TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "color"       TEXT NOT NULL DEFAULT '#6B7280',
    "order"       INTEGER NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "isWon"       BOOLEAN NOT NULL DEFAULT false,
    "isLost"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Lead
CREATE TABLE "Lead" (
    "id"                TEXT NOT NULL,
    "organizationId"    TEXT NOT NULL,
    "contactId"         TEXT,
    "title"             TEXT NOT NULL,
    "value"             DECIMAL(12,2),
    "currency"          TEXT NOT NULL DEFAULT 'INR',
    "pipelineId"        TEXT,
    "stageId"           TEXT,
    "status"            "LeadStatus" NOT NULL DEFAULT 'NEW',
    "priority"          "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
    "source"            TEXT,
    "assignedToId"      TEXT,
    "expectedCloseDate" TIMESTAMP(3),
    "actualCloseDate"   TIMESTAMP(3),
    "lastActivityAt"    TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LeadActivity
CREATE TABLE "LeadActivity" (
    "id"          TEXT NOT NULL,
    "leadId"      TEXT NOT NULL,
    "userId"      TEXT,
    "type"        "ActivityType" NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "metadata"    JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LeadNote
CREATE TABLE "LeadNote" (
    "id"        TEXT NOT NULL,
    "leadId"    TEXT NOT NULL,
    "userId"    TEXT,
    "content"   TEXT NOT NULL,
    "isPinned"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LeadTask
CREATE TABLE "LeadTask" (
    "id"          TEXT NOT NULL,
    "leadId"      TEXT NOT NULL,
    "userId"      TEXT,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "dueDate"     TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "priority"    "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ContactNote
CREATE TABLE "ContactNote" (
    "id"        TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId"    TEXT,
    "content"   TEXT NOT NULL,
    "isPinned"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Pipeline
CREATE UNIQUE INDEX "Pipeline_organizationId_name_key" ON "Pipeline"("organizationId", "name");
CREATE INDEX "Pipeline_organizationId_idx" ON "Pipeline"("organizationId");

-- CreateIndex: PipelineStage
CREATE INDEX "PipelineStage_pipelineId_idx" ON "PipelineStage"("pipelineId");
CREATE INDEX "PipelineStage_order_idx" ON "PipelineStage"("order");

-- CreateIndex: Lead
CREATE INDEX "Lead_organizationId_idx" ON "Lead"("organizationId");
CREATE INDEX "Lead_contactId_idx" ON "Lead"("contactId");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_pipelineId_stageId_idx" ON "Lead"("pipelineId", "stageId");
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- CreateIndex: LeadActivity
CREATE INDEX "LeadActivity_leadId_idx" ON "LeadActivity"("leadId");
CREATE INDEX "LeadActivity_createdAt_idx" ON "LeadActivity"("createdAt");

-- CreateIndex: LeadNote
CREATE INDEX "LeadNote_leadId_idx" ON "LeadNote"("leadId");

-- CreateIndex: LeadTask
CREATE INDEX "LeadTask_leadId_idx" ON "LeadTask"("leadId");
CREATE INDEX "LeadTask_dueDate_idx" ON "LeadTask"("dueDate");
CREATE INDEX "LeadTask_isCompleted_idx" ON "LeadTask"("isCompleted");

-- CreateIndex: ContactNote
CREATE INDEX "ContactNote_contactId_idx" ON "ContactNote"("contactId");

-- AddForeignKey: Pipeline → Organization
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: PipelineStage → Pipeline
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey"
    FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Lead → Organization
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Lead → Contact
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Lead → Pipeline
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_pipelineId_fkey"
    FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Lead → PipelineStage
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: LeadActivity → Lead
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LeadNote → Lead
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: LeadTask → Lead
ALTER TABLE "LeadTask" ADD CONSTRAINT "LeadTask_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ContactNote → Contact
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
