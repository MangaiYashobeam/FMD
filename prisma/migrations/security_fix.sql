-- Fixed migration for TEXT-based user IDs
CREATE TABLE IF NOT EXISTS extension_session_tokens (
    id VARCHAR(255) PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    extension_id VARCHAR(255) NOT NULL,
    device_fingerprint VARCHAR(255) NOT NULL,
    signing_key VARCHAR(255) NOT NULL,
    capabilities TEXT[] DEFAULT ARRAY[]::TEXT[],
    revoked BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ext_tokens_user_id ON extension_session_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_ext_tokens_account_id ON extension_session_tokens(account_id);
CREATE INDEX IF NOT EXISTS idx_ext_tokens_expires_at ON extension_session_tokens(expires_at);

CREATE TABLE IF NOT EXISTS security_audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    event_type VARCHAR(100) NOT NULL,
    user_id TEXT,
    account_id TEXT,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    request_id VARCHAR(100),
    path VARCHAR(500),
    method VARCHAR(10),
    status_code INTEGER,
    success BOOLEAN DEFAULT TRUE,
    risk_level VARCHAR(20) DEFAULT 'LOW',
    sensitive_data_accessed BOOLEAN DEFAULT FALSE,
    pci_relevant BOOLEAN DEFAULT FALSE,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON security_audit_logs(created_at);
