-- Security Infrastructure Migration
-- FaceMyDealer Green Route, Invitations, and Security System

-- Registration Invitation Codes
CREATE TABLE IF NOT EXISTS "registration_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "inviter_type" VARCHAR(50) NOT NULL DEFAULT 'admin',
    "inviter_id" UUID,
    "inviter_email" VARCHAR(255),
    "account_name" VARCHAR(255),
    "company_domain" VARCHAR(255),
    "intended_role" VARCHAR(50) NOT NULL DEFAULT 'NEW_USER',
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "used_at" TIMESTAMP(3),
    "used_by_user_id" UUID,
    "is_trial" BOOLEAN NOT NULL DEFAULT false,
    "trial_days" INTEGER NOT NULL DEFAULT 15,
    "dealer_license_url" VARCHAR(500),
    "dealer_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "registration_invitations_code_key" ON "registration_invitations"("code");
CREATE INDEX IF NOT EXISTS "registration_invitations_code_idx" ON "registration_invitations"("code");
CREATE INDEX IF NOT EXISTS "registration_invitations_email_idx" ON "registration_invitations"("email");
CREATE INDEX IF NOT EXISTS "registration_invitations_status_idx" ON "registration_invitations"("status");

-- OAuth Links (soft-link for whitelisting)
CREATE TABLE IF NOT EXISTS "oauth_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_user_id" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "whitelisted" BOOLEAN NOT NULL DEFAULT false,
    "whitelisted_at" TIMESTAMP(3),
    "whitelisted_by" UUID,
    "extension_linked" BOOLEAN NOT NULL DEFAULT false,
    "extension_linked_at" TIMESTAMP(3),
    "extension_id" VARCHAR(255),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_links_provider_provider_user_id_key" ON "oauth_links"("provider", "provider_user_id");
CREATE INDEX IF NOT EXISTS "oauth_links_user_id_idx" ON "oauth_links"("user_id");
CREATE INDEX IF NOT EXISTS "oauth_links_email_idx" ON "oauth_links"("email");

-- Green Route Request Logs
CREATE TABLE IF NOT EXISTS "green_route_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" VARCHAR(255) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "source" VARCHAR(50) NOT NULL,
    "account_id" UUID,
    "user_id" UUID,
    "fingerprint" VARCHAR(255),
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" TEXT NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_time_ms" INTEGER NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "whitelisted" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "green_route_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "green_route_logs_request_id_key" ON "green_route_logs"("request_id");
CREATE INDEX IF NOT EXISTS "green_route_logs_account_id_idx" ON "green_route_logs"("account_id");
CREATE INDEX IF NOT EXISTS "green_route_logs_user_id_idx" ON "green_route_logs"("user_id");
CREATE INDEX IF NOT EXISTS "green_route_logs_source_idx" ON "green_route_logs"("source");
CREATE INDEX IF NOT EXISTS "green_route_logs_created_at_idx" ON "green_route_logs"("created_at");

-- Green Route Analytics (aggregated)
CREATE TABLE IF NOT EXISTS "green_route_analytics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "path" VARCHAR(500) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "last_accessed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "green_route_analytics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "green_route_analytics_path_method_key" ON "green_route_analytics"("path", "method");

-- Origin Validation Logs
CREATE TABLE IF NOT EXISTS "origin_validation_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "path" VARCHAR(500) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "origin" VARCHAR(255),
    "referer" VARCHAR(500),
    "extension_id" VARCHAR(255),
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" TEXT NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "reason" VARCHAR(255),
    "source" VARCHAR(50),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "origin_validation_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "origin_validation_logs_blocked_idx" ON "origin_validation_logs"("blocked");
CREATE INDEX IF NOT EXISTS "origin_validation_logs_source_idx" ON "origin_validation_logs"("source");
CREATE INDEX IF NOT EXISTS "origin_validation_logs_created_at_idx" ON "origin_validation_logs"("created_at");

-- Dealer Verification Requests
CREATE TABLE IF NOT EXISTS "dealer_verification_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "company_domain" VARCHAR(255),
    "verification_type" VARCHAR(50) NOT NULL DEFAULT 'domain',
    "dealer_license_url" VARCHAR(500),
    "dealer_license_number" VARCHAR(100),
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" UUID,
    "review_notes" TEXT,
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dealer_verification_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dealer_verification_requests_email_idx" ON "dealer_verification_requests"("email");
CREATE INDEX IF NOT EXISTS "dealer_verification_requests_status_idx" ON "dealer_verification_requests"("status");

-- Account Whitelist (for API access)
CREATE TABLE IF NOT EXISTS "account_whitelists" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "is_whitelisted" BOOLEAN NOT NULL DEFAULT false,
    "whitelisted_at" TIMESTAMP(3),
    "whitelisted_by" UUID,
    "green_route_access" BOOLEAN NOT NULL DEFAULT false,
    "api_key_access" BOOLEAN NOT NULL DEFAULT false,
    "extension_access" BOOLEAN NOT NULL DEFAULT true,
    "custom_rate_limit" INTEGER,
    "reason" VARCHAR(500),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_whitelists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_whitelists_account_id_key" ON "account_whitelists"("account_id");

-- Foreign Key Constraints
ALTER TABLE "oauth_links" ADD CONSTRAINT "oauth_links_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "account_whitelists" ADD CONSTRAINT "account_whitelists_account_id_fkey" 
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add created/updated triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_registration_invitations_updated_at') THEN
        CREATE TRIGGER update_registration_invitations_updated_at
            BEFORE UPDATE ON registration_invitations
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_oauth_links_updated_at') THEN
        CREATE TRIGGER update_oauth_links_updated_at
            BEFORE UPDATE ON oauth_links
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_dealer_verification_requests_updated_at') THEN
        CREATE TRIGGER update_dealer_verification_requests_updated_at
            BEFORE UPDATE ON dealer_verification_requests
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_account_whitelists_updated_at') THEN
        CREATE TRIGGER update_account_whitelists_updated_at
            BEFORE UPDATE ON account_whitelists
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END;
$$;
