-- Session Analytics Migration
-- Created: 2026-01-24
-- Adds comprehensive session tracking, visitor analytics, IP intelligence, and bot detection

-- Add new columns to users table for session tracking
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "login_count" INTEGER DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_session_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_ip_address" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_user_agent" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "login_method" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "visit_heat_score" INTEGER DEFAULT 0;

-- Create user_sessions table
CREATE TABLE IF NOT EXISTS "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "device_type" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logout_at" TIMESTAMP(3),
    "duration" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "login_method" TEXT,
    "ip_info" JSONB,
    "bot_score" INTEGER NOT NULL DEFAULT 0,
    "threat_level" TEXT NOT NULL DEFAULT 'NORMAL',
    "country" TEXT,
    "country_code" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- Create session_activities table
CREATE TABLE IF NOT EXISTS "session_activities" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "path" TEXT,
    "method" TEXT,
    "status_code" INTEGER,
    "response_ms" INTEGER,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_activities_pkey" PRIMARY KEY ("id")
);

-- Create visitors table
CREATE TABLE IF NOT EXISTS "visitors" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "visit_count" INTEGER NOT NULL DEFAULT 1,
    "heat_score" INTEGER NOT NULL DEFAULT 0,
    "first_visit_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_visit_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitor_type" TEXT NOT NULL DEFAULT 'first_time',
    "potential_user" BOOLEAN NOT NULL DEFAULT false,
    "potential_score" INTEGER NOT NULL DEFAULT 0,
    "converted_at" TIMESTAMP(3),
    "converted_user_id" TEXT,
    "last_ip_address" TEXT,
    "last_user_agent" TEXT,
    "last_country" TEXT,
    "last_city" TEXT,
    "is_bot_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "bot_score" INTEGER NOT NULL DEFAULT 0,
    "bot_indicators" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bot_name" TEXT,

    CONSTRAINT "visitors_pkey" PRIMARY KEY ("id")
);

-- Create visitor_sessions table
CREATE TABLE IF NOT EXISTS "visitor_sessions" (
    "id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "duration" INTEGER,
    "page_views" INTEGER NOT NULL DEFAULT 0,
    "entry_page" TEXT,
    "exit_page" TEXT,
    "referrer" TEXT,
    "device_type" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "country" TEXT,
    "country_code" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "ip_info" JSONB,
    "bot_score" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visitor_sessions_pkey" PRIMARY KEY ("id")
);

-- Create visitor_page_views table
CREATE TABLE IF NOT EXISTS "visitor_page_views" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "duration" INTEGER,
    "scroll_depth" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visitor_page_views_pkey" PRIMARY KEY ("id")
);

-- Create ip_intelligence table
CREATE TABLE IF NOT EXISTS "ip_intelligence" (
    "id" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "country" TEXT,
    "country_code" TEXT,
    "region" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT,
    "isp" TEXT,
    "org" TEXT,
    "asn" TEXT,
    "threat_score" INTEGER NOT NULL DEFAULT 0,
    "threat_level" TEXT NOT NULL DEFAULT 'NORMAL',
    "is_proxy" BOOLEAN NOT NULL DEFAULT false,
    "is_vpn" BOOLEAN NOT NULL DEFAULT false,
    "is_tor" BOOLEAN NOT NULL DEFAULT false,
    "is_datacenter" BOOLEAN NOT NULL DEFAULT false,
    "is_known_abuser" BOOLEAN NOT NULL DEFAULT false,
    "is_bot_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "bot_score" INTEGER NOT NULL DEFAULT 0,
    "bot_name" TEXT,
    "bot_type" TEXT,
    "bot_identifiers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "total_requests" INTEGER NOT NULL DEFAULT 0,
    "requests_today" INTEGER NOT NULL DEFAULT 0,
    "last_request_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "blocked_at" TIMESTAMP(3),
    "blocked_reason" TEXT,
    "auto_blocked" BOOLEAN NOT NULL DEFAULT false,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_data" JSONB,

    CONSTRAINT "ip_intelligence_pkey" PRIMARY KEY ("id")
);

-- Create known_bots table
CREATE TABLE IF NOT EXISTS "known_bots" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "user_agent_pattern" TEXT,
    "ip_ranges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_good" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "website" TEXT,
    "last_seen_at" TIMESTAMP(3),
    "total_requests" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "known_bots_pkey" PRIMARY KEY ("id")
);

-- Create admin_login_audit table
CREATE TABLE IF NOT EXISTS "admin_login_audit" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "login_method" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "failure_reason" TEXT,
    "country" TEXT,
    "city" TEXT,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "suspicious_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_login_audit_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "user_sessions_session_token_key" ON "user_sessions"("session_token");
CREATE UNIQUE INDEX IF NOT EXISTS "visitors_fingerprint_key" ON "visitors"("fingerprint");
CREATE UNIQUE INDEX IF NOT EXISTS "visitor_sessions_session_token_key" ON "visitor_sessions"("session_token");
CREATE UNIQUE INDEX IF NOT EXISTS "ip_intelligence_ip_address_key" ON "ip_intelligence"("ip_address");
CREATE UNIQUE INDEX IF NOT EXISTS "known_bots_name_key" ON "known_bots"("name");

-- Create indexes for user_sessions
CREATE INDEX IF NOT EXISTS "user_sessions_user_id_idx" ON "user_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "user_sessions_session_token_idx" ON "user_sessions"("session_token");
CREATE INDEX IF NOT EXISTS "user_sessions_ip_address_idx" ON "user_sessions"("ip_address");
CREATE INDEX IF NOT EXISTS "user_sessions_login_at_idx" ON "user_sessions"("login_at");
CREATE INDEX IF NOT EXISTS "user_sessions_is_active_idx" ON "user_sessions"("is_active");

-- Create indexes for session_activities
CREATE INDEX IF NOT EXISTS "session_activities_session_id_idx" ON "session_activities"("session_id");
CREATE INDEX IF NOT EXISTS "session_activities_timestamp_idx" ON "session_activities"("timestamp");
CREATE INDEX IF NOT EXISTS "session_activities_action_idx" ON "session_activities"("action");

-- Create indexes for visitors
CREATE INDEX IF NOT EXISTS "visitors_fingerprint_idx" ON "visitors"("fingerprint");
CREATE INDEX IF NOT EXISTS "visitors_heat_score_idx" ON "visitors"("heat_score");
CREATE INDEX IF NOT EXISTS "visitors_visitor_type_idx" ON "visitors"("visitor_type");
CREATE INDEX IF NOT EXISTS "visitors_is_bot_confirmed_idx" ON "visitors"("is_bot_confirmed");

-- Create indexes for visitor_sessions
CREATE INDEX IF NOT EXISTS "visitor_sessions_visitor_id_idx" ON "visitor_sessions"("visitor_id");
CREATE INDEX IF NOT EXISTS "visitor_sessions_session_token_idx" ON "visitor_sessions"("session_token");
CREATE INDEX IF NOT EXISTS "visitor_sessions_ip_address_idx" ON "visitor_sessions"("ip_address");
CREATE INDEX IF NOT EXISTS "visitor_sessions_started_at_idx" ON "visitor_sessions"("started_at");

-- Create indexes for visitor_page_views
CREATE INDEX IF NOT EXISTS "visitor_page_views_session_id_idx" ON "visitor_page_views"("session_id");
CREATE INDEX IF NOT EXISTS "visitor_page_views_path_idx" ON "visitor_page_views"("path");

-- Create indexes for ip_intelligence
CREATE INDEX IF NOT EXISTS "ip_intelligence_ip_address_idx" ON "ip_intelligence"("ip_address");
CREATE INDEX IF NOT EXISTS "ip_intelligence_threat_score_idx" ON "ip_intelligence"("threat_score");
CREATE INDEX IF NOT EXISTS "ip_intelligence_is_bot_confirmed_idx" ON "ip_intelligence"("is_bot_confirmed");
CREATE INDEX IF NOT EXISTS "ip_intelligence_is_blocked_idx" ON "ip_intelligence"("is_blocked");

-- Create indexes for known_bots
CREATE INDEX IF NOT EXISTS "known_bots_name_idx" ON "known_bots"("name");
CREATE INDEX IF NOT EXISTS "known_bots_type_idx" ON "known_bots"("type");

-- Create indexes for admin_login_audit
CREATE INDEX IF NOT EXISTS "admin_login_audit_user_id_idx" ON "admin_login_audit"("user_id");
CREATE INDEX IF NOT EXISTS "admin_login_audit_email_idx" ON "admin_login_audit"("email");
CREATE INDEX IF NOT EXISTS "admin_login_audit_timestamp_idx" ON "admin_login_audit"("timestamp");
CREATE INDEX IF NOT EXISTS "admin_login_audit_ip_address_idx" ON "admin_login_audit"("ip_address");

-- Add foreign key constraints
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "session_activities" ADD CONSTRAINT "session_activities_session_id_fkey" 
    FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visitor_sessions" ADD CONSTRAINT "visitor_sessions_visitor_id_fkey" 
    FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visitor_page_views" ADD CONSTRAINT "visitor_page_views_session_id_fkey" 
    FOREIGN KEY ("session_id") REFERENCES "visitor_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert some default known bots
INSERT INTO "known_bots" ("id", "name", "type", "user_agent_pattern", "is_good", "description", "updated_at") VALUES
    (gen_random_uuid()::text, 'Googlebot', 'search_engine', 'googlebot', true, 'Google Search Bot', NOW()),
    (gen_random_uuid()::text, 'Bingbot', 'search_engine', 'bingbot', true, 'Microsoft Bing Search Bot', NOW()),
    (gen_random_uuid()::text, 'DuckDuckBot', 'search_engine', 'duckduckbot', true, 'DuckDuckGo Search Bot', NOW()),
    (gen_random_uuid()::text, 'FacebookExternalHit', 'social', 'facebookexternalhit', true, 'Facebook Link Preview Bot', NOW()),
    (gen_random_uuid()::text, 'Twitterbot', 'social', 'twitterbot', true, 'Twitter Link Preview Bot', NOW()),
    (gen_random_uuid()::text, 'SemrushBot', 'scraper', 'semrushbot', false, 'Semrush SEO Crawler', NOW()),
    (gen_random_uuid()::text, 'AhrefsBot', 'scraper', 'ahrefsbot', false, 'Ahrefs SEO Crawler', NOW()),
    (gen_random_uuid()::text, 'MJ12bot', 'scraper', 'mj12bot', false, 'Majestic SEO Crawler', NOW())
ON CONFLICT (name) DO NOTHING;
