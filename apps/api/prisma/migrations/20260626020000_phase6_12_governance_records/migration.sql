-- Phase 6-12: Generic governance records for alerts, config, release, task, file,
-- notification, feature flag, model gateway, cost, prompt, and evaluation metadata.

-- CreateEnum
CREATE TYPE "GovernanceRecordKind" AS ENUM (
    'ALERT_RULE',
    'ALERT_EVENT',
    'CONFIGURATION',
    'SECRET_METADATA',
    'DEPLOYMENT',
    'TASK',
    'FILE_OBJECT',
    'NOTIFICATION',
    'FEATURE_FLAG',
    'MODEL_ROUTE',
    'USAGE_RECORD',
    'COST_RECORD',
    'PROMPT_VERSION',
    'EVALUATION_RUN'
);

-- CreateTable
CREATE TABLE "GovernanceRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceId" TEXT,
    "environmentSlug" TEXT,
    "kind" "GovernanceRecordKind" NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GovernanceRecord_projectId_idx" ON "GovernanceRecord"("projectId");

-- CreateIndex
CREATE INDEX "GovernanceRecord_serviceId_idx" ON "GovernanceRecord"("serviceId");

-- CreateIndex
CREATE INDEX "GovernanceRecord_environmentSlug_idx" ON "GovernanceRecord"("environmentSlug");

-- CreateIndex
CREATE INDEX "GovernanceRecord_kind_idx" ON "GovernanceRecord"("kind");

-- CreateIndex
CREATE INDEX "GovernanceRecord_status_idx" ON "GovernanceRecord"("status");

-- CreateIndex
CREATE INDEX "GovernanceRecord_createdAt_idx" ON "GovernanceRecord"("createdAt");

-- AddForeignKey
ALTER TABLE "GovernanceRecord" ADD CONSTRAINT "GovernanceRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceRecord" ADD CONSTRAINT "GovernanceRecord_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
