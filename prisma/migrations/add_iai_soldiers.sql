-- IAI Soldier Command Center Schema
-- Add to existing schema.prisma

-- CreateTable
CREATE TABLE "iai_soldiers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "soldier_number" SERIAL NOT NULL,
    "soldier_id" TEXT NOT NULL UNIQUE, -- IAI-0, IAI-1, etc.
    "account_id" TEXT NOT NULL,
    "user_id" TEXT,
    
    -- Status
    "status" TEXT NOT NULL DEFAULT 'offline', -- online, offline, working, idle, error
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    
    -- Identity
    "browser_id" TEXT,
    "extension_version" TEXT,
    "user_agent" TEXT,
    
    -- Location & Network
    "ip_address" TEXT,
    "location_country" TEXT,
    "location_city" TEXT,
    "location_lat" DECIMAL(10, 8),
    "location_lng" DECIMAL(11, 8),
    "timezone" TEXT,
    
    -- Performance Stats
    "tasks_completed" INTEGER NOT NULL DEFAULT 0,
    "tasks_failed" INTEGER NOT NULL DEFAULT 0,
    "total_runtime_minutes" INTEGER NOT NULL DEFAULT 0,
    "avg_task_duration_sec" INTEGER,
    "success_rate" DECIMAL(5, 2),
    
    -- Current Work
    "current_task_id" TEXT,
    "current_task_type" TEXT,
    "current_task_started_at" TIMESTAMP(3),
    
    -- Heartbeat
    "last_heartbeat_at" TIMESTAMP(3),
    "last_poll_at" TIMESTAMP(3),
    "last_task_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_error_at" TIMESTAMP(3),
    
    -- Session
    "session_start_at" TIMESTAMP(3),
    "session_end_at" TIMESTAMP(3),
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "iai_soldiers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE,
    CONSTRAINT "iai_soldiers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

-- CreateTable
CREATE TABLE "iai_activity_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "soldier_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    
    -- Event Details
    "event_type" TEXT NOT NULL, -- heartbeat, task_start, task_complete, task_fail, status_change, error
    "event_data" JSONB,
    "message" TEXT,
    
    -- Task Reference
    "task_id" TEXT,
    "task_type" TEXT,
    "task_result" JSONB,
    
    -- Location at time of event
    "ip_address" TEXT,
    "location_lat" DECIMAL(10, 8),
    "location_lng" DECIMAL(11, 8),
    
    -- Timestamps
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "iai_activity_logs_soldier_id_fkey" FOREIGN KEY ("soldier_id") REFERENCES "iai_soldiers"("id") ON DELETE CASCADE,
    CONSTRAINT "iai_activity_logs_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE
);

-- CreateTable
CREATE TABLE "iai_performance_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "soldier_id" TEXT NOT NULL,
    
    -- Snapshot Time
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Metrics
    "tasks_in_period" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "avg_duration_sec" INTEGER,
    "cpu_usage" DECIMAL(5, 2),
    "memory_usage_mb" INTEGER,
    
    -- Status
    "status" TEXT NOT NULL,
    "errors_count" INTEGER NOT NULL DEFAULT 0,
    
    CONSTRAINT "iai_performance_snapshots_soldier_id_fkey" FOREIGN KEY ("soldier_id") REFERENCES "iai_soldiers"("id") ON DELETE CASCADE
);

-- CreateIndex
CREATE INDEX "iai_soldiers_account_id_idx" ON "iai_soldiers"("account_id");
CREATE INDEX "iai_soldiers_status_idx" ON "iai_soldiers"("status");
CREATE INDEX "iai_soldiers_soldier_id_idx" ON "iai_soldiers"("soldier_id");
CREATE INDEX "iai_soldiers_last_heartbeat_at_idx" ON "iai_soldiers"("last_heartbeat_at");

CREATE INDEX "iai_activity_logs_soldier_id_idx" ON "iai_activity_logs"("soldier_id");
CREATE INDEX "iai_activity_logs_account_id_idx" ON "iai_activity_logs"("account_id");
CREATE INDEX "iai_activity_logs_event_type_idx" ON "iai_activity_logs"("event_type");
CREATE INDEX "iai_activity_logs_created_at_idx" ON "iai_activity_logs"("created_at");

CREATE INDEX "iai_performance_snapshots_soldier_id_idx" ON "iai_performance_snapshots"("soldier_id");
CREATE INDEX "iai_performance_snapshots_snapshot_at_idx" ON "iai_performance_snapshots"("snapshot_at");
