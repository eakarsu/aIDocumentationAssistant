-- Additive, tenant-safe governance migration. Existing users receive a personal
-- legacy workspace so connector rows can be backfilled without data loss.

DO $$ BEGIN CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'REVIEWER', 'VIEWER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ConnectorSyncStatus" AS ENUM ('NEVER', 'QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ToolJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'RETRY_WAIT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GateDecision" AS ENUM ('PASS', 'REVIEW', 'BLOCK'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "Tenant" ("id", "name", "slug")
SELECT 'legacy-' || "id", COALESCE(NULLIF(TRIM("firstName" || ' ' || "lastName"), ''), "email") || ' workspace', 'legacy-' || "id"
FROM "User"
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS "TenantMembership" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "TenantMembership_tenantId_userId_key" ON "TenantMembership"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "TenantMembership_userId_idx" ON "TenantMembership"("userId");
INSERT INTO "TenantMembership" ("id", "tenantId", "userId", "role")
SELECT 'legacy-membership-' || "id", 'legacy-' || "id", "id", 'OWNER'::"TenantRole"
FROM "User"
ON CONFLICT DO NOTHING;

ALTER TABLE "Repository" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "Repository" ADD COLUMN IF NOT EXISTS "syncCursor" TEXT;
ALTER TABLE "Repository" ADD COLUMN IF NOT EXISTS "lastSyncStatus" "ConnectorSyncStatus" NOT NULL DEFAULT 'NEVER';
ALTER TABLE "Repository" ADD COLUMN IF NOT EXISTS "lastSyncError" TEXT;
ALTER TABLE "Repository" ADD COLUMN IF NOT EXISTS "freshUntil" TIMESTAMP(3);
ALTER TABLE "Repository" ADD COLUMN IF NOT EXISTS "connectorPolicy" JSONB;
UPDATE "Repository" SET "tenantId" = 'legacy-' || "createdById" WHERE "tenantId" IS NULL;
ALTER TABLE "Repository" ALTER COLUMN "tenantId" SET NOT NULL;
DROP INDEX IF EXISTS "Repository_provider_fullName_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Repository_provider_tenantId_fullName_key" ON "Repository"("provider", "tenantId", "fullName");
CREATE INDEX IF NOT EXISTS "Repository_tenantId_idx" ON "Repository"("tenantId");

ALTER TABLE "ParsedCodeFile" ADD COLUMN IF NOT EXISTS "sourceCommitSha" TEXT;
ALTER TABLE "ParsedCodeFile" ADD COLUMN IF NOT EXISTS "contentText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ParsedCodeFile" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;
ALTER TABLE "ParsedCodeFile" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
ALTER TABLE "ParsedCodeFile" ADD COLUMN IF NOT EXISTS "lastSeenSyncId" TEXT;
ALTER TABLE "ParsedCodeFile" ADD COLUMN IF NOT EXISTS "lastIndexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ParsedCodeFile" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "ParsedCodeFile_repositoryId_deletedAt_idx" ON "ParsedCodeFile"("repositoryId", "deletedAt");

ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "deliveryId" TEXT;
UPDATE "WebhookEvent" SET "deliveryId" = "id" WHERE "deliveryId" IS NULL;
ALTER TABLE "WebhookEvent" ALTER COLUMN "deliveryId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_repositoryId_deliveryId_key" ON "WebhookEvent"("repositoryId", "deliveryId");

CREATE TABLE IF NOT EXISTS "ConnectorSyncRun" (
  "id" TEXT PRIMARY KEY,
  "repositoryId" TEXT NOT NULL,
  "status" "ConnectorSyncStatus" NOT NULL DEFAULT 'QUEUED',
  "sourceRevision" TEXT,
  "cursor" TEXT,
  "filesSeen" INTEGER NOT NULL DEFAULT 0,
  "filesChanged" INTEGER NOT NULL DEFAULT 0,
  "filesDeleted" INTEGER NOT NULL DEFAULT 0,
  "errors" JSONB,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ConnectorSyncRun_repositoryId_createdAt_idx" ON "ConnectorSyncRun"("repositoryId", "createdAt");
CREATE INDEX IF NOT EXISTS "ConnectorSyncRun_status_idx" ON "ConnectorSyncRun"("status");

CREATE TABLE IF NOT EXISTS "GovernedToolJob" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "repositoryId" TEXT,
  "requestedById" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" "ToolJobStatus" NOT NULL DEFAULT 'QUEUED',
  "input" JSONB NOT NULL,
  "output" JSONB,
  "error" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
  "costBudgetCents" INTEGER NOT NULL DEFAULT 25,
  "latencyBudgetMs" INTEGER NOT NULL DEFAULT 15000,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "traceId" TEXT NOT NULL,
  "cancelRequestedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "GovernedToolJob_tenantId_idempotencyKey_key" ON "GovernedToolJob"("tenantId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "GovernedToolJob_status_availableAt_idx" ON "GovernedToolJob"("status", "availableAt");
CREATE INDEX IF NOT EXISTS "GovernedToolJob_tenantId_createdAt_idx" ON "GovernedToolJob"("tenantId", "createdAt");

CREATE TABLE IF NOT EXISTS "AiRun" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL UNIQUE,
  "requestedById" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "inputSchemaVersion" TEXT NOT NULL,
  "outputSchemaVersion" TEXT NOT NULL,
  "output" JSONB NOT NULL,
  "citations" JSONB NOT NULL,
  "providerReceipt" JSONB,
  "promptDigest" TEXT NOT NULL,
  "outputDigest" TEXT NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "costCents" INTEGER NOT NULL DEFAULT 0,
  "latencyMs" INTEGER NOT NULL,
  "qualityScore" DOUBLE PRECISION NOT NULL,
  "safetyScore" DOUBLE PRECISION NOT NULL,
  "gateDecision" "GateDecision" NOT NULL,
  "traceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AiRun_tenantId_createdAt_idx" ON "AiRun"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiRun_gateDecision_idx" ON "AiRun"("gateDecision");

CREATE TABLE IF NOT EXISTS "HumanApproval" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "aiRunId" TEXT NOT NULL UNIQUE,
  "reviewerId" TEXT NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "attestations" JSONB NOT NULL,
  "comment" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "HumanApproval_tenantId_status_idx" ON "HumanApproval"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "EvaluationCase" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "toolName" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "expected" JSONB NOT NULL,
  "rubric" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "EvaluationCase_tenantId_name_key" ON "EvaluationCase"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "EvaluationCase_tenantId_toolName_idx" ON "EvaluationCase"("tenantId", "toolName");

CREATE TABLE IF NOT EXISTS "EvaluationRun" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "output" JSONB NOT NULL,
  "qualityScore" DOUBLE PRECISION NOT NULL,
  "safetyScore" DOUBLE PRECISION NOT NULL,
  "costCents" INTEGER NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "decision" "GateDecision" NOT NULL,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "EvaluationRun_tenantId_createdAt_idx" ON "EvaluationRun"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "EvaluationRun_caseId_idx" ON "EvaluationRun"("caseId");

DO $$ BEGIN ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "TenantMembership" ADD CONSTRAINT "TenantMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Repository" ADD CONSTRAINT "Repository_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ConnectorSyncRun" ADD CONSTRAINT "ConnectorSyncRun_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "GovernedToolJob" ADD CONSTRAINT "GovernedToolJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "GovernedToolJob" ADD CONSTRAINT "GovernedToolJob_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "GovernedToolJob" ADD CONSTRAINT "GovernedToolJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GovernedToolJob"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HumanApproval" ADD CONSTRAINT "HumanApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HumanApproval" ADD CONSTRAINT "HumanApproval_aiRunId_fkey" FOREIGN KEY ("aiRunId") REFERENCES "AiRun"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "HumanApproval" ADD CONSTRAINT "HumanApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EvaluationCase" ADD CONSTRAINT "EvaluationCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "EvaluationCase"("id") ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
