-- =====================================================
-- Enterprise Security Infrastructure Migration
-- PCI-DSS & SOC2 Compliant Schema Extensions
-- =====================================================
-- 
-- This migration adds:
-- 1. Extension Session Tokens (replaces bundled secrets)
-- 2. Security Audit Logs (PCI-DSS 10.x compliance)
-- 3. Threat Intelligence (IP reputation tracking)
-- 
-- Run: psql -U facemydealer -d dealersface -f security_enterprise.sql
-- =====================================================

-- =====================================================
-- 1. EXTENSION SESSION TOKENS
-- Purpose: Secure token exchange - NO bundled secrets in extension
-- =====================================================

CREATE TABLE IF NOT EXISTS extension_session_tokens (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    extension_id VARCHAR(255) NOT NULL,
    device_fingerprint VARCHAR(255) NOT NULL,
    signing_key VARCHAR(255) NOT NULL,
    capabilities TEXT[] DEFAULT ARRAY[]::TEXT[],
    revoked BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ext_tokens_user_id ON extension_session_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_ext_tokens_account_id ON extension_session_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_ext_tokens_extension_id ON extension_session_tokens(extension_id);
CREATE INDEX IF NOT EXISTS idx_ext_tokens_expires_at ON extension_session_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_ext_tokens_active ON extension_session_tokens(user_id, expires_at) WHERE revoked = FALSE;

-- =====================================================
-- 2. SECURITY AUDIT LOGS (PCI-DSS 10.x)
-- Purpose: Immutable audit trail for security events
-- =====================================================

CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    request_id VARCHAR(100),
    path VARCHAR(500),
    method VARCHAR(10),
    status_code INTEGER,
    success BOOLEAN DEFAULT TRUE,
    risk_level VARCHAR(20) DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    sensitive_data_accessed BOOLEAN DEFAULT FALSE,
    pci_relevant BOOLEAN DEFAULT FALSE,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying (PCI-DSS requires queryable audit logs)
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_account_id ON security_audit_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_risk_level ON security_audit_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON security_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_pci ON security_audit_logs(pci_relevant, created_at) WHERE pci_relevant = TRUE;
CREATE INDEX IF NOT EXISTS idx_audit_ip ON security_audit_logs(ip_address);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_user_time ON security_audit_logs(user_id, created_at DESC);

-- =====================================================
-- 3. THREAT INTELLIGENCE
-- Purpose: IP reputation and threat tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS threat_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) UNIQUE NOT NULL,
    threat_score INTEGER DEFAULT 0,
    blocked BOOLEAN DEFAULT FALSE,
    reasons TEXT[] DEFAULT ARRAY[]::TEXT[],
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    attack_count INTEGER DEFAULT 0,
    country_code VARCHAR(2),
    asn VARCHAR(50),
    isp VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for threat lookups
CREATE INDEX IF NOT EXISTS idx_threat_ip ON threat_intelligence(ip_address);
CREATE INDEX IF NOT EXISTS idx_threat_score ON threat_intelligence(threat_score);
CREATE INDEX IF NOT EXISTS idx_threat_blocked ON threat_intelligence(blocked);

-- =====================================================
-- 4. SECURITY CONFIGURATION TABLE
-- Purpose: Store security settings with encryption keys
-- =====================================================

CREATE TABLE IF NOT EXISTS security_configuration (
    id VARCHAR(50) PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    is_encrypted BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. RATE LIMIT TRACKING (Distributed)
-- Purpose: Support rate limiting across multiple instances
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_limit_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) NOT NULL,
    hits INTEGER DEFAULT 1,
    reset_time TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limit_key ON rate_limit_entries(key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit_entries(reset_time);

-- Auto-cleanup function for rate limits
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_entries WHERE reset_time < NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. UPDATE TRIGGERS
-- =====================================================

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to threat_intelligence
DROP TRIGGER IF EXISTS trigger_threat_intel_updated ON threat_intelligence;
CREATE TRIGGER trigger_threat_intel_updated
    BEFORE UPDATE ON threat_intelligence
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to security_configuration
DROP TRIGGER IF EXISTS trigger_security_config_updated ON security_configuration;
CREATE TRIGGER trigger_security_config_updated
    BEFORE UPDATE ON security_configuration
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 7. SECURITY EVENT TYPES (Reference Data)
-- =====================================================

CREATE TABLE IF NOT EXISTS security_event_types (
    code VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    default_risk_level VARCHAR(20) DEFAULT 'LOW',
    pci_relevant BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert standard security event types
INSERT INTO security_event_types (code, name, description, default_risk_level, pci_relevant) VALUES
    ('LOGIN_SUCCESS', 'Successful Login', 'User successfully authenticated', 'LOW', TRUE),
    ('LOGIN_FAILURE', 'Failed Login Attempt', 'Authentication failed', 'MEDIUM', TRUE),
    ('LOGOUT', 'User Logout', 'User logged out', 'LOW', TRUE),
    ('PASSWORD_CHANGE', 'Password Changed', 'User changed their password', 'MEDIUM', TRUE),
    ('PASSWORD_RESET_REQUEST', 'Password Reset Requested', 'Password reset was requested', 'MEDIUM', TRUE),
    ('MFA_ENABLED', '2FA Enabled', 'Two-factor authentication enabled', 'LOW', TRUE),
    ('MFA_DISABLED', '2FA Disabled', 'Two-factor authentication disabled', 'HIGH', TRUE),
    ('PERMISSION_CHANGE', 'Permission Changed', 'User permissions were modified', 'HIGH', TRUE),
    ('DATA_EXPORT', 'Data Exported', 'User exported data from system', 'MEDIUM', TRUE),
    ('CREDENTIALS_ACCESS', 'Credentials Accessed', 'Sensitive credentials were accessed', 'MEDIUM', TRUE),
    ('CREDENTIALS_UPDATE', 'Credentials Updated', 'Sensitive credentials were updated', 'HIGH', TRUE),
    ('SUSPICIOUS_ACTIVITY', 'Suspicious Activity', 'Potentially malicious behavior detected', 'HIGH', FALSE),
    ('RATE_LIMIT_EXCEEDED', 'Rate Limit Exceeded', 'Request rate limit was exceeded', 'MEDIUM', FALSE),
    ('INVALID_TOKEN', 'Invalid Token', 'Invalid authentication token used', 'MEDIUM', TRUE),
    ('SESSION_HIJACK_ATTEMPT', 'Session Hijack Attempt', 'Possible session hijacking detected', 'CRITICAL', TRUE),
    ('API_KEY_CREATED', 'API Key Created', 'New API key was created', 'LOW', TRUE),
    ('API_KEY_REVOKED', 'API Key Revoked', 'API key was revoked', 'LOW', TRUE),
    ('ADMIN_ACTION', 'Administrative Action', 'Administrative action performed', 'MEDIUM', TRUE)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 8. INDEXES FOR PERFORMANCE
-- =====================================================

-- GIN index for JSONB fields (faster JSON queries)
CREATE INDEX IF NOT EXISTS idx_audit_details_gin ON security_audit_logs USING gin(details);
CREATE INDEX IF NOT EXISTS idx_threat_metadata_gin ON threat_intelligence USING gin(metadata);

-- =====================================================
-- 9. ROW LEVEL SECURITY (Optional - for multi-tenant)
-- =====================================================

-- Enable RLS on sensitive tables (can be enabled per-table)
-- ALTER TABLE security_audit_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE threat_intelligence ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 10. GRANTS (adjust role names as needed)
-- =====================================================

-- Read-only access for audit/compliance team
-- CREATE ROLE IF NOT EXISTS audit_reader;
-- GRANT SELECT ON security_audit_logs TO audit_reader;
-- GRANT SELECT ON security_event_types TO audit_reader;
-- GRANT SELECT ON threat_intelligence TO audit_reader;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Verify tables created
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN (
    'extension_session_tokens',
    'security_audit_logs', 
    'threat_intelligence',
    'security_configuration',
    'rate_limit_entries',
    'security_event_types'
);
