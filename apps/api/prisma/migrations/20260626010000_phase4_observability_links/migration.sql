-- Phase 4: Observability control-plane links

-- CreateEnum
CREATE TYPE "ObservabilitySignal" AS ENUM ('LOGS', 'METRICS', 'TRACES', 'DASHBOARD');

-- CreateTable
CREATE TABLE "ObservabilityLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "serviceId" TEXT,
    "environmentSlug" TEXT,
    "signal" "ObservabilitySignal" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservabilityLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ObservabilityLink_projectId_idx" ON "ObservabilityLink"("projectId");

-- CreateIndex
CREATE INDEX "ObservabilityLink_serviceId_idx" ON "ObservabilityLink"("serviceId");

-- CreateIndex
CREATE INDEX "ObservabilityLink_environmentSlug_idx" ON "ObservabilityLink"("environmentSlug");

-- CreateIndex
CREATE INDEX "ObservabilityLink_signal_idx" ON "ObservabilityLink"("signal");

-- AddForeignKey
ALTER TABLE "ObservabilityLink" ADD CONSTRAINT "ObservabilityLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservabilityLink" ADD CONSTRAINT "ObservabilityLink_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
