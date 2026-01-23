-- Create IAI Soldiers table
CREATE TABLE IF NOT EXISTS iai_soldiers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    soldier_number SERIAL,
    soldier_id VARCHAR(50) UNIQUE NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'offline',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Identity
    browser_id VARCHAR(255),
    extension_version VARCHAR(50),
    user_agent TEXT,
    
    -- Location & Network
    ip_address VARCHAR(50),
    location_country VARCHAR(100),
    location_city VARCHAR(100),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    timezone VARCHAR(100),
    
    -- Performance Stats
    tasks_completed INT DEFAULT 0,
    tasks_failed INT DEFAULT 0,
    total_runtime_minutes INT DEFAULT 0,
    avg_task_duration_sec INT,
    success_rate DECIMAL(5, 2),
    
    -- Current Work
    current_task_id VARCHAR(255),
    current_task_type VARCHAR(100),
    current_task_started_at TIMESTAMP,
    
    -- Heartbeat
    last_heartbeat_at TIMESTAMP,
    last_poll_at TIMESTAMP,
    last_task_at TIMESTAMP,
    last_error TEXT,
    last_error_at TIMESTAMP,
    
    -- Session
    session_start_at TIMESTAMP,
    session_end_at TIMESTAMP,
    total_sessions INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iai_soldiers_account ON iai_soldiers(account_id);
CREATE INDEX IF NOT EXISTS idx_iai_soldiers_status ON iai_soldiers(status);
CREATE INDEX IF NOT EXISTS idx_iai_soldiers_soldier_id ON iai_soldiers(soldier_id);
CREATE INDEX IF NOT EXISTS idx_iai_soldiers_heartbeat ON iai_soldiers(last_heartbeat_at);

-- Create IAI Activity Logs table
CREATE TABLE IF NOT EXISTS iai_activity_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    soldier_id TEXT NOT NULL REFERENCES iai_soldiers(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Event Details
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    message TEXT,
    
    -- Task Reference
    task_id VARCHAR(255),
    task_type VARCHAR(100),
    task_result JSONB,
    
    -- Location at time of event
    ip_address VARCHAR(50),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_iai_activity_soldier ON iai_activity_logs(soldier_id);
CREATE INDEX IF NOT EXISTS idx_iai_activity_account ON iai_activity_logs(account_id);
CREATE INDEX IF NOT EXISTS idx_iai_activity_event_type ON iai_activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_iai_activity_created ON iai_activity_logs(created_at);

-- Create IAI Performance Snapshots table
CREATE TABLE IF NOT EXISTS iai_performance_snapshots (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    soldier_id TEXT NOT NULL REFERENCES iai_soldiers(id) ON DELETE CASCADE,
    
    -- Snapshot Time
    snapshot_at TIMESTAMP DEFAULT NOW(),
    
    -- Metrics
    tasks_in_period INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    avg_duration_sec INT,
    cpu_usage DECIMAL(5, 2),
    memory_usage_mb INT,
    
    -- Status
    status VARCHAR(20),
    errors_count INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_iai_performance_soldier ON iai_performance_snapshots(soldier_id);
CREATE INDEX IF NOT EXISTS idx_iai_performance_snapshot ON iai_performance_snapshots(snapshot_at);
