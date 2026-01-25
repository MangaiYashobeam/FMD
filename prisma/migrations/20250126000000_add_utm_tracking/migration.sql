-- Add UTM Source Tracking fields to users table
-- These track how users discovered and registered on the platform

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utm_source" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utm_medium" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utm_campaign" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utm_term" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "utm_content" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_code" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_ip" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_country" TEXT;

-- Create index for UTM source analytics
CREATE INDEX IF NOT EXISTS "users_utm_source_idx" ON "users"("utm_source");
CREATE INDEX IF NOT EXISTS "users_utm_campaign_idx" ON "users"("utm_campaign");
CREATE INDEX IF NOT EXISTS "users_referral_code_idx" ON "users"("referral_code");
CREATE INDEX IF NOT EXISTS "users_signup_country_idx" ON "users"("signup_country");
