-- CreateTable PatternOverride
CREATE TABLE IF NOT EXISTS "pattern_overrides" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "user_id" TEXT,
    "container_id" TEXT NOT NULL,
    "pattern_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "reason" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pattern_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex for PatternOverride
CREATE INDEX IF NOT EXISTS "pattern_overrides_account_id_idx" ON "pattern_overrides"("account_id");
CREATE INDEX IF NOT EXISTS "pattern_overrides_user_id_idx" ON "pattern_overrides"("user_id");
CREATE INDEX IF NOT EXISTS "pattern_overrides_container_id_idx" ON "pattern_overrides"("container_id");
CREATE INDEX IF NOT EXISTS "pattern_overrides_pattern_id_idx" ON "pattern_overrides"("pattern_id");
CREATE INDEX IF NOT EXISTS "pattern_overrides_is_active_idx" ON "pattern_overrides"("is_active");

-- Unique constraint for one override per account/user/container
CREATE UNIQUE INDEX IF NOT EXISTS "pattern_overrides_account_id_user_id_container_id_key" ON "pattern_overrides"("account_id", "user_id", "container_id");

-- Add pattern tracking columns to iai_soldiers
ALTER TABLE "iai_soldiers" ADD COLUMN IF NOT EXISTS "current_pattern_id" TEXT;
ALTER TABLE "iai_soldiers" ADD COLUMN IF NOT EXISTS "current_pattern_name" TEXT;
ALTER TABLE "iai_soldiers" ADD COLUMN IF NOT EXISTS "pattern_loaded_at" TIMESTAMP(3);
ALTER TABLE "iai_soldiers" ADD COLUMN IF NOT EXISTS "pattern_source" TEXT;

-- CreateIndex for pattern tracking on soldiers
CREATE INDEX IF NOT EXISTS "iai_soldiers_current_pattern_id_idx" ON "iai_soldiers"("current_pattern_id");
