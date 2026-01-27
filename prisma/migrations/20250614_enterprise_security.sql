-- ============================================
-- Enterprise Security Tables Migration
-- ============================================
-- 
-- Creates tables for SSRF prevention and security management
-- Run this AFTER deploying the new code
--

-- SSRF Domain Allowlist
CREATE TABLE IF NOT EXISTS ssrf_allowlist_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'other',
    match_type VARCHAR(50) DEFAULT 'exact',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    added_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ssrf_allowlist_domains_category ON ssrf_allowlist_domains(category);
CREATE INDEX IF NOT EXISTS idx_ssrf_allowlist_domains_active ON ssrf_allowlist_domains(is_active);
CREATE INDEX IF NOT EXISTS idx_ssrf_allowlist_domains_domain ON ssrf_allowlist_domains(domain);

-- SSRF Blocked IP Prefixes
CREATE TABLE IF NOT EXISTS ssrf_blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_prefix VARCHAR(45) UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'custom',
    reason TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    added_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ssrf_blocked_ips_category ON ssrf_blocked_ips(category);
CREATE INDEX IF NOT EXISTS idx_ssrf_blocked_ips_active ON ssrf_blocked_ips(is_active);

-- SSRF Proxy Request Logs
CREATE TABLE IF NOT EXISTS ssrf_proxy_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_url TEXT NOT NULL,
    domain VARCHAR(255),
    ip VARCHAR(45),
    blocked BOOLEAN DEFAULT false,
    reason VARCHAR(500),
    status_code INTEGER,
    response_time INTEGER,
    user_id UUID,
    account_id UUID,
    user_agent TEXT,
    referer TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssrf_proxy_logs_blocked ON ssrf_proxy_logs(blocked);
CREATE INDEX IF NOT EXISTS idx_ssrf_proxy_logs_domain ON ssrf_proxy_logs(domain);
CREATE INDEX IF NOT EXISTS idx_ssrf_proxy_logs_timestamp ON ssrf_proxy_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_ssrf_proxy_logs_user ON ssrf_proxy_logs(user_id);

-- SSRF Block Events
CREATE TABLE IF NOT EXISTS ssrf_block_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_prefix VARCHAR(45) NOT NULL,
    attempted_url TEXT NOT NULL,
    resolved_ip VARCHAR(45),
    user_id UUID,
    account_id UUID,
    user_agent TEXT,
    referer TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssrf_block_events_ip ON ssrf_block_events(ip_prefix);
CREATE INDEX IF NOT EXISTS idx_ssrf_block_events_timestamp ON ssrf_block_events(timestamp);

-- Enterprise Security Configuration
CREATE TABLE IF NOT EXISTS enterprise_security_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ssrf_protection_enabled BOOLEAN DEFAULT true,
    private_ip_blocking_enabled BOOLEAN DEFAULT true,
    domain_allowlist_enabled BOOLEAN DEFAULT true,
    strict_mode_enabled BOOLEAN DEFAULT false,
    audit_logging_enabled BOOLEAN DEFAULT true,
    real_time_alerts_enabled BOOLEAN DEFAULT true,
    max_requests_per_minute INTEGER DEFAULT 1000,
    block_duration INTEGER DEFAULT 3600,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- Seed Default Data
-- ============================================

-- Insert default configuration
INSERT INTO enterprise_security_config (
    ssrf_protection_enabled,
    private_ip_blocking_enabled,
    domain_allowlist_enabled,
    strict_mode_enabled,
    audit_logging_enabled,
    real_time_alerts_enabled,
    max_requests_per_minute,
    block_duration
) SELECT true, true, true, false, true, true, 1000, 3600
WHERE NOT EXISTS (SELECT 1 FROM enterprise_security_config);

-- Insert default allowed domains
INSERT INTO ssrf_allowlist_domains (domain, category, match_type, description, added_by) VALUES
('.fbcdn.net', 'facebook', 'suffix', 'Facebook CDN', 'system'),
('.fna.fbcdn.net', 'facebook', 'suffix', 'Facebook CDN (FNA)', 'system'),
('.facebook.com', 'facebook', 'suffix', 'Facebook main domain', 'system'),
('.fbsbx.com', 'facebook', 'suffix', 'Facebook sandbox', 'system'),
('.s3.amazonaws.com', 'aws', 'suffix', 'AWS S3 buckets', 'system'),
('.cloudfront.net', 'aws', 'suffix', 'AWS CloudFront CDN', 'system'),
('.cloudflare.com', 'cloudflare', 'suffix', 'Cloudflare domains', 'system'),
('.cloudflareimages.com', 'cloudflare', 'suffix', 'Cloudflare Images', 'system'),
('.googleusercontent.com', 'cdn', 'suffix', 'Google User Content', 'system'),
('dealersface.com', 'dealer', 'exact', 'Our production domain', 'system'),
('.dealersface.com', 'dealer', 'suffix', 'Dealersface subdomains', 'system')
ON CONFLICT (domain) DO NOTHING;

-- Insert default blocked IP prefixes
INSERT INTO ssrf_blocked_ips (ip_prefix, category, reason, added_by) VALUES
('10.', 'private', 'RFC 1918 Class A private network (10.0.0.0/8)', 'system'),
('172.16.', 'private', 'RFC 1918 Class B private network start (172.16.0.0/12)', 'system'),
('172.17.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.18.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.19.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.20.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.21.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.22.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.23.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.24.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.25.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.26.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.27.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.28.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.29.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.30.', 'private', 'RFC 1918 Class B private network', 'system'),
('172.31.', 'private', 'RFC 1918 Class B private network end', 'system'),
('192.168.', 'private', 'RFC 1918 Class C private network (192.168.0.0/16)', 'system'),
('127.', 'loopback', 'Loopback address (127.0.0.0/8)', 'system'),
('0.', 'loopback', 'Current network (0.0.0.0/8)', 'system'),
('169.254.', 'linklocal', 'Link-local addresses (169.254.0.0/16)', 'system'),
('169.254.169.254', 'cloud_metadata', 'AWS/GCP/Azure metadata endpoint', 'system'),
('100.100.100.200', 'cloud_metadata', 'Alibaba Cloud metadata endpoint', 'system'),
('224.', 'custom', 'Multicast addresses (224.0.0.0/4)', 'system'),
('240.', 'custom', 'Reserved for future use (240.0.0.0/4)', 'system')
ON CONFLICT (ip_prefix) DO NOTHING;

-- Done
SELECT 'Enterprise Security migration completed!' as status;
