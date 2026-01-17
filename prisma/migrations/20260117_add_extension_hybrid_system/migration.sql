-- Migration: add_extension_hybrid_system
-- Created: January 17, 2026
-- Description: Adds tables for Chrome Extension AI Hybrid System

-- ============================================
-- User Model Updates
-- ============================================

-- Add new columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_picture" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "facebook_id" TEXT UNIQUE;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "facebook_access_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "facebook_token_expiry" TIMESTAMP(3);

-- Make password_hash nullable (for OAuth-only users)
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- ============================================
-- Extension Task Queue
-- ============================================

CREATE TABLE IF NOT EXISTS "extension_tasks" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "data" JSONB,
    "result" JSONB,
    "vehicle_id" TEXT,
    "lead_id" TEXT,
    "scheduled_for" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "extension_tasks_account_id_idx" ON "extension_tasks"("account_id");
CREATE INDEX IF NOT EXISTS "extension_tasks_status_idx" ON "extension_tasks"("status");
CREATE INDEX IF NOT EXISTS "extension_tasks_type_idx" ON "extension_tasks"("type");
CREATE INDEX IF NOT EXISTS "extension_tasks_priority_idx" ON "extension_tasks"("priority");
CREATE INDEX IF NOT EXISTS "extension_tasks_scheduled_for_idx" ON "extension_tasks"("scheduled_for");

-- ============================================
-- AI Response Queue
-- ============================================

CREATE TABLE IF NOT EXISTS "ai_responses" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "response_text" TEXT NOT NULL,
    "response_type" TEXT NOT NULL,
    "conversation_analysis" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "was_edited" BOOLEAN NOT NULL DEFAULT false,
    "edited_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_responses_account_id_idx" ON "ai_responses"("account_id");
CREATE INDEX IF NOT EXISTS "ai_responses_lead_id_idx" ON "ai_responses"("lead_id");
CREATE INDEX IF NOT EXISTS "ai_responses_status_idx" ON "ai_responses"("status");

-- ============================================
-- Message History
-- ============================================

CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "facebook_message_id" TEXT,
    "text" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "is_outgoing" BOOLEAN NOT NULL DEFAULT false,
    "sentiment" TEXT,
    "intent" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "messages_lead_id_facebook_message_id_key" ON "messages"("lead_id", "facebook_message_id");
CREATE INDEX IF NOT EXISTS "messages_lead_id_idx" ON "messages"("lead_id");
CREATE INDEX IF NOT EXISTS "messages_sent_at_idx" ON "messages"("sent_at");

-- Add foreign key
ALTER TABLE "messages" ADD CONSTRAINT "messages_lead_id_fkey" 
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Facebook Session Storage
-- ============================================

CREATE TABLE IF NOT EXISTS "facebook_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL UNIQUE,
    "cookies" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "last_validated" TIMESTAMP(3) NOT NULL,
    "last_activity" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_sessions_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- Dealer Account (for Extension)
-- ============================================

CREATE TABLE IF NOT EXISTS "dealer_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL UNIQUE,
    "business_name" TEXT,
    "business_address" TEXT,
    "business_phone" TEXT,
    "facebook_connected" BOOLEAN NOT NULL DEFAULT false,
    "facebook_user_id" TEXT,
    "auto_respond" BOOLEAN NOT NULL DEFAULT false,
    "response_delay" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_accounts_pkey" PRIMARY KEY ("id")
);

-- Add foreign key
ALTER TABLE "dealer_accounts" ADD CONSTRAINT "dealer_accounts_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Success Message
-- ============================================

-- Migration complete! Tables created:
-- - extension_tasks (task queue for browser automation)
-- - ai_responses (AI-generated response queue)
-- - messages (conversation message history)
-- - facebook_sessions (browser session storage)
-- - dealer_accounts (dealer settings for extension)
-- 
-- User table updated with:
-- - facebook_id, facebook_access_token, facebook_token_expiry
-- - name, profile_picture
-- - password_hash now nullable
