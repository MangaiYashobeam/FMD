-- AI Orchestrator Complete Database Schema
-- Generated: 2026-01-25
-- Description: Complete AI model orchestration system with health monitoring, rate limiting, and cost tracking

-- AI Model Health Status - Real-time monitoring
CREATE TABLE IF NOT EXISTS "ai_model_health" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "model_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "latency_ms" INTEGER,
    "error_rate" DECIMAL(5,2),
    "last_checked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "last_success" TIMESTAMP(3),
    "checks_count" INTEGER NOT NULL DEFAULT 0,
    "fails_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_health_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on model_id
CREATE UNIQUE INDEX IF NOT EXISTS "ai_model_health_model_id_key" ON "ai_model_health"("model_id");

-- Indexes
CREATE INDEX IF NOT EXISTS "ai_model_health_status_idx" ON "ai_model_health"("status");
CREATE INDEX IF NOT EXISTS "ai_model_health_provider_idx" ON "ai_model_health"("provider");
CREATE INDEX IF NOT EXISTS "ai_model_health_last_checked_idx" ON "ai_model_health"("last_checked");

-- AI Rate Limit Configuration
CREATE TABLE IF NOT EXISTS "ai_rate_limits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "model_id" TEXT NOT NULL,
    "account_id" TEXT,
    "requests_per_minute" INTEGER,
    "requests_per_hour" INTEGER,
    "requests_per_day" INTEGER,
    "tokens_per_minute" INTEGER,
    "tokens_per_hour" INTEGER,
    "tokens_per_day" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_rate_limits_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on model_id + account_id
CREATE UNIQUE INDEX IF NOT EXISTS "ai_rate_limits_model_id_account_id_key" ON "ai_rate_limits"("model_id", "account_id");

-- Indexes
CREATE INDEX IF NOT EXISTS "ai_rate_limits_model_id_idx" ON "ai_rate_limits"("model_id");
CREATE INDEX IF NOT EXISTS "ai_rate_limits_account_id_idx" ON "ai_rate_limits"("account_id");

-- AI Cost Tracking
CREATE TABLE IF NOT EXISTS "ai_cost_tracking" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "model_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "user_id" TEXT,
    "period" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_cost_tracking_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on model_id + account_id + period + period_start
CREATE UNIQUE INDEX IF NOT EXISTS "ai_cost_tracking_model_account_period_key" ON "ai_cost_tracking"("model_id", "account_id", "period", "period_start");

-- Indexes
CREATE INDEX IF NOT EXISTS "ai_cost_tracking_account_period_idx" ON "ai_cost_tracking"("account_id", "period_start");
CREATE INDEX IF NOT EXISTS "ai_cost_tracking_model_period_idx" ON "ai_cost_tracking"("model_id", "period_start");

-- Ensure existing AI tables have proper indexes (if they don't exist)

-- AI Session Notes indexes
CREATE INDEX IF NOT EXISTS "ai_session_notes_session_id_idx" ON "ai_session_notes"("session_id");
CREATE INDEX IF NOT EXISTS "ai_session_notes_account_id_idx" ON "ai_session_notes"("account_id");
CREATE INDEX IF NOT EXISTS "ai_session_notes_expires_at_idx" ON "ai_session_notes"("expires_at");

-- AI Task Assignments indexes
CREATE INDEX IF NOT EXISTS "ai_task_assignments_task_type_idx" ON "ai_task_assignments"("task_type");
CREATE INDEX IF NOT EXISTS "ai_task_assignments_assignment_level_idx" ON "ai_task_assignments"("assignment_level");
CREATE INDEX IF NOT EXISTS "ai_task_assignments_account_id_idx" ON "ai_task_assignments"("account_id");

-- AI Model Usage indexes
CREATE INDEX IF NOT EXISTS "ai_model_usage_model_id_idx" ON "ai_model_usage"("model_id");
CREATE INDEX IF NOT EXISTS "ai_model_usage_agent_id_idx" ON "ai_model_usage"("agent_id");
CREATE INDEX IF NOT EXISTS "ai_model_usage_account_id_idx" ON "ai_model_usage"("account_id");
CREATE INDEX IF NOT EXISTS "ai_model_usage_created_at_idx" ON "ai_model_usage"("created_at");

-- AI Routing Rules indexes
CREATE INDEX IF NOT EXISTS "ai_routing_rules_priority_idx" ON "ai_routing_rules"("priority");
CREATE INDEX IF NOT EXISTS "ai_routing_rules_account_id_idx" ON "ai_routing_rules"("account_id");
CREATE INDEX IF NOT EXISTS "ai_routing_rules_enabled_idx" ON "ai_routing_rules"("enabled");

-- AI Handoff Logs indexes
CREATE INDEX IF NOT EXISTS "ai_handoff_logs_session_id_idx" ON "ai_handoff_logs"("session_id");
CREATE INDEX IF NOT EXISTS "ai_handoff_logs_account_id_idx" ON "ai_handoff_logs"("account_id");
CREATE INDEX IF NOT EXISTS "ai_handoff_logs_created_at_idx" ON "ai_handoff_logs"("created_at");

-- Company AI Preferences (ensure table exists)
CREATE TABLE IF NOT EXISTS "company_ai_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" TEXT NOT NULL,
    "default_model" TEXT,
    "allowed_models" TEXT[] DEFAULT '{}',
    "blocked_models" TEXT[] DEFAULT '{}',
    "max_tokens_per_request" INTEGER,
    "max_requests_per_day" INTEGER,
    "cost_budget_daily" DECIMAL(10,2),
    "cost_budget_monthly" DECIMAL(10,2),
    "enable_vision" BOOLEAN NOT NULL DEFAULT true,
    "enable_code_gen" BOOLEAN NOT NULL DEFAULT true,
    "enable_automation" BOOLEAN NOT NULL DEFAULT true,
    "custom_instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_ai_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_ai_preferences_account_id_key" ON "company_ai_preferences"("account_id");

-- Seed default model health for all registered models
INSERT INTO "ai_model_health" ("id", "model_id", "provider", "status", "updated_at")
SELECT 
    gen_random_uuid(),
    model_id,
    provider,
    'unknown',
    CURRENT_TIMESTAMP
FROM (VALUES 
    ('gpt-4.1', 'openai'),
    ('gpt-4o', 'openai'),
    ('gpt-5-mini', 'openai'),
    ('gpt-5', 'openai'),
    ('gpt-5.1', 'openai'),
    ('gpt-5.2', 'openai'),
    ('gpt-5-codex-preview', 'openai'),
    ('gpt-5.1-codex', 'openai'),
    ('gpt-5.1-codex-max', 'openai'),
    ('gpt-5.1-codex-mini-preview', 'openai'),
    ('gpt-5.2-codex', 'openai'),
    ('claude-haiku-4.5', 'anthropic'),
    ('claude-opus-4.5', 'anthropic'),
    ('claude-sonnet-4', 'anthropic'),
    ('claude-sonnet-4.5', 'anthropic'),
    ('gemini-2.5-pro', 'google'),
    ('gemini-3-flash-preview', 'google'),
    ('gemini-3-pro-preview', 'google'),
    ('raptor-mini-preview', 'internal')
) AS models(model_id, provider)
ON CONFLICT ("model_id") DO NOTHING;

-- Seed default global rate limits (generous defaults)
INSERT INTO "ai_rate_limits" ("id", "model_id", "account_id", "requests_per_minute", "requests_per_hour", "requests_per_day", "tokens_per_minute", "tokens_per_hour", "tokens_per_day", "updated_at")
SELECT 
    gen_random_uuid(),
    model_id,
    NULL, -- global
    100, -- per minute
    2000, -- per hour
    20000, -- per day
    100000, -- tokens per minute
    1000000, -- tokens per hour
    10000000, -- tokens per day
    CURRENT_TIMESTAMP
FROM (VALUES 
    ('gpt-4.1'),
    ('gpt-4o'),
    ('gpt-5-mini'),
    ('gpt-5'),
    ('claude-opus-4.5'),
    ('claude-sonnet-4'),
    ('claude-sonnet-4.5'),
    ('gemini-2.5-pro')
) AS models(model_id)
ON CONFLICT DO NOTHING;
