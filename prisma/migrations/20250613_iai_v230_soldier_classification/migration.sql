-- IAI Architecture v2.3.0 Migration
-- Three-class IAI Soldier Classification System
-- Date: 2025-06-13

-- ============================================
-- Step 1: Create new ENUM types
-- ============================================

-- Soldier Genre - Three official soldier classes
CREATE TYPE "SoldierGenre" AS ENUM ('SOLDIER', 'STEALTH', 'NOVA');

-- Execution Source - Where the soldier runs
CREATE TYPE "ExecutionSource" AS ENUM ('EXTENSION', 'CHROMIUM');

-- Soldier Mode - How the soldier behaves
CREATE TYPE "SoldierMode" AS ENUM ('USM', 'STEALTH', 'HYBRID', 'NOVA_AI');

-- Soldier Status - Operational status
CREATE TYPE "SoldierStatus" AS ENUM ('ONLINE', 'OFFLINE', 'WORKING', 'IDLE', 'ERROR', 'SUSPENDED');

-- Mission Profile - Targeting profiles
CREATE TYPE "MissionProfile" AS ENUM ('FBM_LISTING', 'FBM_MESSAGES', 'FBM_FULL', 'TRAINING', 'INTELLIGENCE', 'CUSTOM');

-- ============================================
-- Step 2: Add new columns to iai_soldiers table
-- ============================================

-- Add soldier classification columns
ALTER TABLE "iai_soldiers" 
ADD COLUMN IF NOT EXISTS "genre" "SoldierGenre" DEFAULT 'SOLDIER',
ADD COLUMN IF NOT EXISTS "execution_source" "ExecutionSource" DEFAULT 'EXTENSION',
ADD COLUMN IF NOT EXISTS "mode" "SoldierMode" DEFAULT 'USM',
ADD COLUMN IF NOT EXISTS "mission_profile" "MissionProfile" DEFAULT 'FBM_LISTING';

-- Add Chromium version for STEALTH/NOVA soldiers
ALTER TABLE "iai_soldiers" 
ADD COLUMN IF NOT EXISTS "chromium_version" TEXT;

-- Add NOVA-specific metrics
ALTER TABLE "iai_soldiers" 
ADD COLUMN IF NOT EXISTS "nova_intelligence_score" INTEGER,
ADD COLUMN IF NOT EXISTS "nova_decisions_made" INTEGER,
ADD COLUMN IF NOT EXISTS "nova_learning_cycles" INTEGER;

-- Convert existing status string to enum (if migration fails on this, skip it)
-- Note: This may need manual intervention depending on existing data

-- ============================================
-- Step 3: Create new indexes on iai_soldiers
-- ============================================

CREATE INDEX IF NOT EXISTS "iai_soldiers_genre_idx" ON "iai_soldiers"("genre");
CREATE INDEX IF NOT EXISTS "iai_soldiers_execution_source_idx" ON "iai_soldiers"("execution_source");
CREATE INDEX IF NOT EXISTS "iai_soldiers_mode_idx" ON "iai_soldiers"("mode");
CREATE INDEX IF NOT EXISTS "iai_soldiers_mission_profile_idx" ON "iai_soldiers"("mission_profile");

-- ============================================
-- Step 4: Create IAI Factory Blueprint table
-- ============================================

CREATE TABLE IF NOT EXISTS "iai_factory_blueprints" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT DEFAULT '1.0.0',
    "blueprint_type" TEXT DEFAULT 'STANDARD',
    "target_genre" "SoldierGenre" DEFAULT 'SOLDIER',
    "target_source" "ExecutionSource" DEFAULT 'EXTENSION',
    "target_mode" "SoldierMode" DEFAULT 'USM',
    "base_config" JSONB NOT NULL DEFAULT '{}',
    "container_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pattern_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hot_swap_enabled" BOOLEAN DEFAULT false,
    "hot_swap_patterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "creation_rate" INTEGER DEFAULT 1,
    "max_concurrent" INTEGER DEFAULT 5,
    "lifespan" INTEGER DEFAULT 3600,
    "auto_respawn" BOOLEAN DEFAULT false,
    "targeting" JSONB DEFAULT '{}',
    "schedule" JSONB DEFAULT '{}',
    "is_active" BOOLEAN DEFAULT true,
    "priority" INTEGER DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "total_created" INTEGER DEFAULT 0,
    "active_count" INTEGER DEFAULT 0,
    "success_rate" DECIMAL(5,2),
    "avg_lifespan" INTEGER,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "iai_factory_blueprints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "iai_factory_blueprints_account_id_idx" ON "iai_factory_blueprints"("account_id");
CREATE INDEX IF NOT EXISTS "iai_factory_blueprints_blueprint_type_idx" ON "iai_factory_blueprints"("blueprint_type");
CREATE INDEX IF NOT EXISTS "iai_factory_blueprints_target_genre_idx" ON "iai_factory_blueprints"("target_genre");
CREATE INDEX IF NOT EXISTS "iai_factory_blueprints_is_active_idx" ON "iai_factory_blueprints"("is_active");

-- Foreign keys for blueprints
ALTER TABLE "iai_factory_blueprints" 
ADD CONSTRAINT "iai_factory_blueprints_account_id_fkey" 
FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "iai_factory_blueprints" 
ADD CONSTRAINT "iai_factory_blueprints_created_by_id_fkey" 
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- Step 5: Create IAI Factory Instance table
-- ============================================

CREATE TABLE IF NOT EXISTS "iai_factory_instances" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "blueprint_id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "soldier_id" TEXT,
    "status" TEXT DEFAULT 'PENDING',
    "current_pattern" TEXT,
    "assigned_company" TEXT,
    "assigned_user" TEXT,
    "container_id" TEXT,
    "spawned_at" TIMESTAMP(3),
    "last_active_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "terminated_at" TIMESTAMP(3),
    "execution_count" INTEGER DEFAULT 0,
    "success_count" INTEGER DEFAULT 0,
    "error_count" INTEGER DEFAULT 0,
    "config" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "iai_factory_instances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "iai_factory_instances_instance_id_key" ON "iai_factory_instances"("instance_id");
CREATE INDEX IF NOT EXISTS "iai_factory_instances_blueprint_id_idx" ON "iai_factory_instances"("blueprint_id");
CREATE INDEX IF NOT EXISTS "iai_factory_instances_status_idx" ON "iai_factory_instances"("status");
CREATE INDEX IF NOT EXISTS "iai_factory_instances_spawned_at_idx" ON "iai_factory_instances"("spawned_at");

-- Foreign key for instances
ALTER TABLE "iai_factory_instances" 
ADD CONSTRAINT "iai_factory_instances_blueprint_id_fkey" 
FOREIGN KEY ("blueprint_id") REFERENCES "iai_factory_blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- Step 6: Create IAI Connection Map table
-- ============================================

CREATE TABLE IF NOT EXISTS "iai_connection_maps" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "connections" JSONB NOT NULL DEFAULT '[]',
    "viewport" JSONB DEFAULT '{}',
    "is_template" BOOLEAN DEFAULT false,
    "template_type" TEXT,
    "template_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "iai_connection_maps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "iai_connection_maps_account_id_idx" ON "iai_connection_maps"("account_id");
CREATE INDEX IF NOT EXISTS "iai_connection_maps_is_template_idx" ON "iai_connection_maps"("is_template");

-- Foreign keys for connection maps
ALTER TABLE "iai_connection_maps" 
ADD CONSTRAINT "iai_connection_maps_account_id_fkey" 
FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "iai_connection_maps" 
ADD CONSTRAINT "iai_connection_maps_created_by_id_fkey" 
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- Step 7: Create IAI Predefined Templates table
-- ============================================

CREATE TABLE IF NOT EXISTS "iai_predefined_templates" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT DEFAULT 'general',
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "connections" JSONB NOT NULL DEFAULT '[]',
    "base_config" JSONB DEFAULT '{}',
    "target_genre" "SoldierGenre" DEFAULT 'SOLDIER',
    "target_source" "ExecutionSource" DEFAULT 'EXTENSION',
    "target_mode" "SoldierMode" DEFAULT 'USM',
    "target_mission" "MissionProfile" DEFAULT 'FBM_LISTING',
    "icon" TEXT,
    "color" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "popularity" INTEGER DEFAULT 0,
    "is_active" BOOLEAN DEFAULT true,
    "version" TEXT DEFAULT '1.0.0',
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "iai_predefined_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "iai_predefined_templates_name_key" ON "iai_predefined_templates"("name");
CREATE INDEX IF NOT EXISTS "iai_predefined_templates_category_idx" ON "iai_predefined_templates"("category");
CREATE INDEX IF NOT EXISTS "iai_predefined_templates_target_genre_idx" ON "iai_predefined_templates"("target_genre");
CREATE INDEX IF NOT EXISTS "iai_predefined_templates_is_active_idx" ON "iai_predefined_templates"("is_active");

-- ============================================
-- Step 8: Insert default predefined templates
-- ============================================

INSERT INTO "iai_predefined_templates" 
("name", "display_name", "description", "category", "nodes", "connections", "base_config", "target_genre", "target_source", "target_mode", "target_mission", "icon", "color", "tags")
VALUES 
(
    'fbm-usm-soldier',
    'FBM USM Soldier',
    'Ultra Speed Mode soldier for Facebook Marketplace vehicle listing. Runs in user Chrome extension with maximum performance.',
    'fbm',
    '[{"id": "soldier-1", "type": "iai", "label": "USM Soldier", "config": {"genre": "SOLDIER", "mode": "USM"}}]',
    '[]',
    '{"speedMultiplier": 3, "stealthLevel": "low", "humanSimulation": false}',
    'SOLDIER',
    'EXTENSION',
    'USM',
    'FBM_LISTING',
    'Zap',
    '#3B82F6',
    ARRAY['fbm', 'usm', 'fast', 'listing']
),
(
    'fbm-stealth-soldier',
    'FBM Stealth Soldier',
    'Invisible Chromium-based soldier with human-like patterns. Runs on dealersface-fbm server for maximum undetectability.',
    'fbm',
    '[{"id": "stealth-1", "type": "iai", "label": "Stealth Soldier", "config": {"genre": "STEALTH", "mode": "STEALTH"}}]',
    '[]',
    '{"speedMultiplier": 1, "stealthLevel": "maximum", "humanSimulation": true, "antiDetection": true}',
    'STEALTH',
    'CHROMIUM',
    'STEALTH',
    'FBM_LISTING',
    'Ghost',
    '#8B5CF6',
    ARRAY['fbm', 'stealth', 'chromium', 'invisible']
),
(
    'nova-full-automation',
    'NOVA Full Automation',
    'Peak automation tier with full NOVA AI integration. Intelligent decision-making, analytics, and adaptive behavior.',
    'intelligence',
    '[{"id": "nova-1", "type": "iai", "label": "NOVA Soldier", "config": {"genre": "NOVA", "mode": "NOVA_AI"}}]',
    '[]',
    '{"aiIntegration": true, "decisionEngine": true, "learningEnabled": true, "analyticsLevel": "full"}',
    'NOVA',
    'CHROMIUM',
    'NOVA_AI',
    'FBM_FULL',
    'Brain',
    '#F59E0B',
    ARRAY['nova', 'ai', 'intelligent', 'full-automation']
),
(
    'hybrid-balanced',
    'Hybrid Balanced',
    'Balanced hybrid configuration combining extension speed with stealth patterns. Good for moderate volume.',
    'general',
    '[{"id": "hybrid-1", "type": "iai", "label": "Hybrid Soldier", "config": {"genre": "SOLDIER", "mode": "HYBRID"}}]',
    '[]',
    '{"speedMultiplier": 2, "stealthLevel": "moderate", "humanSimulation": true}',
    'SOLDIER',
    'EXTENSION',
    'HYBRID',
    'FBM_LISTING',
    'Layers',
    '#10B981',
    ARRAY['hybrid', 'balanced', 'moderate']
),
(
    'messenger-stealth',
    'Messenger Stealth',
    'Stealth soldier optimized for Facebook Marketplace message handling. Human-like response patterns.',
    'messaging',
    '[{"id": "messenger-1", "type": "iai", "label": "Messenger Soldier", "config": {"genre": "STEALTH", "mode": "STEALTH"}}]',
    '[]',
    '{"messageMode": true, "responseDelay": "human", "typingSimulation": true}',
    'STEALTH',
    'CHROMIUM',
    'STEALTH',
    'FBM_MESSAGES',
    'MessageSquare',
    '#EC4899',
    ARRAY['messaging', 'stealth', 'responses']
)
ON CONFLICT ("name") DO NOTHING;

-- ============================================
-- Migration Complete
-- ============================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'IAI v2.3.0 Migration completed successfully';
    RAISE NOTICE 'New ENUMs: SoldierGenre, ExecutionSource, SoldierMode, SoldierStatus, MissionProfile';
    RAISE NOTICE 'New Tables: iai_factory_blueprints, iai_factory_instances, iai_connection_maps, iai_predefined_templates';
    RAISE NOTICE 'Updated: iai_soldiers with classification columns';
END $$;
