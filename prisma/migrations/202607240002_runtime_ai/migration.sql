CREATE TABLE IF NOT EXISTS "RuntimeAiResult" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "providerReceipt" JSONB,
  "result" TEXT NOT NULL,
  "usage" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "RuntimeAiResult_userId_createdAt_idx"
  ON "RuntimeAiResult"("userId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "RuntimeAiResult" ADD CONSTRAINT "RuntimeAiResult_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
