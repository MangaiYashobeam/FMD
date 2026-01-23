# IAI Command Center - Production Documentation

## Overview

The **IAI (Intelligent Automation Interface) Command Center** is a production-grade, real-time monitoring and control system for managing distributed browser automation agents (IAI Soldiers). This system provides comprehensive tracking, logging, and performance monitoring capabilities for Chrome extension-based automation tasks.

## 🏗️ Architecture

### Components

1. **Database Layer** (PostgreSQL)
   - `iai_soldiers` - Core soldier registry with status, location, and performance metrics
   - `iai_activity_logs` - Detailed event logging for all soldier actions
   - `iai_performance_snapshots` - Time-series performance data for analytics

2. **Backend API** (Node.js/Express)
   - Admin endpoints for dashboard access
   - Extension endpoints for soldier registration and reporting
   - Real-time data aggregation and statistics

3. **Chrome Extension** (background-ai.js)
   - Auto-registration as numbered IAI soldiers (IAI-0, IAI-1, IAI-2...)
   - Heartbeat monitoring every 30 seconds
   - Comprehensive activity logging
   - Geolocation tracking

4. **Web Dashboard** (React/TypeScript)
   - Real-time soldier monitoring
   - Status filtering and pagination
   - Detailed soldier profiles with logs
   - Performance metrics visualization

## 🔒 Security Features

### Authentication & Authorization
- **JWT Token-based authentication** for all API endpoints
- **Role-based access control** - Super Admin only
- **Token validation** on every request
- **Secure storage** of sensitive data (encrypted passwords, tokens)

### Data Protection
- **SQL injection prevention** via Prisma ORM parameterized queries
- **XSS protection** with React's built-in escaping
- **CORS configuration** to prevent unauthorized API access
- **Rate limiting** on API endpoints (future enhancement)

### Privacy
- **IP-based geolocation** (no GPS tracking)
- **Anonymous browser IDs** (UUID-based)
- **Encrypted storage** of authentication tokens
- **Audit logging** for all critical operations

## 📊 Database Schema

### iai_soldiers Table

```sql
CREATE TABLE iai_soldiers (
  id UUID PRIMARY KEY,
  soldier_number SERIAL,
  soldier_id VARCHAR UNIQUE, -- IAI-0, IAI-1, etc.
  account_id UUID NOT NULL,
  user_id UUID,
  status VARCHAR DEFAULT 'offline', -- online, offline, working, idle, error
  is_active BOOLEAN DEFAULT true,
  
  -- Identity
  browser_id VARCHAR,
  extension_version VARCHAR,
  user_agent VARCHAR,
  
  -- Location
  ip_address VARCHAR,
  location_country VARCHAR,
  location_city VARCHAR,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  timezone VARCHAR,
  
  -- Performance
  tasks_completed INT DEFAULT 0,
  tasks_failed INT DEFAULT 0,
  success_rate DECIMAL(5,2),
  avg_task_duration_sec INT,
  total_runtime_minutes INT DEFAULT 0,
  
  -- Current Work
  current_task_id VARCHAR,
  current_task_type VARCHAR,
  current_task_started_at TIMESTAMP,
  
  -- Heartbeat
  last_heartbeat_at TIMESTAMP,
  last_poll_at TIMESTAMP,
  last_task_at TIMESTAMP,
  last_error VARCHAR,
  last_error_at TIMESTAMP,
  
  -- Session
  session_start_at TIMESTAMP,
  session_end_at TIMESTAMP,
  total_sessions INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `idx_soldiers_account_id` - Fast account filtering
- `idx_soldiers_status` - Status-based queries
- `idx_soldiers_soldier_id` - Unique soldier lookup
- `idx_soldiers_heartbeat` - Stale detection

### iai_activity_logs Table

```sql
CREATE TABLE iai_activity_logs (
  id UUID PRIMARY KEY,
  soldier_id UUID NOT NULL,
  account_id UUID NOT NULL,
  event_type VARCHAR NOT NULL, -- heartbeat, task_start, task_complete, task_fail, status_change, error
  event_data JSONB,
  message VARCHAR,
  task_id VARCHAR,
  task_type VARCHAR,
  task_result JSONB,
  ip_address VARCHAR,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes:**
- `idx_activity_soldier_id` - Per-soldier logs
- `idx_activity_account_id` - Per-account filtering
- `idx_activity_event_type` - Event filtering
- `idx_activity_created_at` - Time-based queries

### iai_performance_snapshots Table

```sql
CREATE TABLE iai_performance_snapshots (
  id UUID PRIMARY KEY,
  soldier_id UUID NOT NULL,
  snapshot_at TIMESTAMP DEFAULT NOW(),
  tasks_in_period INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  avg_duration_sec INT,
  cpu_usage DECIMAL(5,2),
  memory_usage_mb INT,
  status VARCHAR NOT NULL,
  errors_count INT DEFAULT 0
);
```

**Indexes:**
- `idx_snapshots_soldier_id` - Per-soldier metrics
- `idx_snapshots_time` - Time-series analysis

## 🔌 API Endpoints

### Admin Endpoints (Protected)

#### `GET /api/admin/iai/soldiers`
List all IAI soldiers with pagination and filtering.

**Query Parameters:**
- `page` (default: 1) - Page number
- `limit` (default: 50) - Results per page
- `status` - Filter by status (online, offline, working, idle, error)
- `accountId` - Filter by account

**Response:**
```json
{
  "soldiers": [
    {
      "id": "uuid",
      "soldierId": "IAI-0",
      "soldierNumber": 0,
      "status": "online",
      "accountId": "uuid",
      "tasksCompleted": 42,
      "tasksFailed": 3,
      "successRate": 93.33,
      "locationCity": "New York",
      "locationCountry": "United States",
      "lastHeartbeatAt": "2026-01-22T18:30:00Z",
      "account": {
        "name": "GAD Productions",
        "dealershipName": "GAD Dealership"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 3,
    "pages": 1
  }
}
```

#### `GET /api/admin/iai/soldiers/:id`
Get detailed information about a specific soldier including logs and performance.

**Response:**
```json
{
  "id": "uuid",
  "soldierId": "IAI-0",
  "status": "working",
  "currentTaskType": "POST_TO_MARKETPLACE",
  "activityLogs": [...],
  "performanceSnapshots": [...]
}
```

#### `GET /api/admin/iai/soldiers/:id/activity`
Get activity logs for a specific soldier.

**Query Parameters:**
- `page`, `limit` - Pagination
- `eventType` - Filter by event type
- `startDate`, `endDate` - Date range filter

#### `GET /api/admin/iai/soldiers/:id/performance`
Get performance metrics over time.

**Query Parameters:**
- `hours` (default: 24) - Time window in hours

#### `GET /api/admin/iai/map-data`
Get all active soldiers with locations for map visualization.

**Response:**
```json
{
  "soldiers": [
    {
      "id": "uuid",
      "soldierId": "IAI-0",
      "status": "online",
      "locationLat": 40.7128,
      "locationLng": -74.0060,
      "locationCity": "New York",
      "currentTaskType": null
    }
  ]
}
```

#### `GET /api/admin/iai/stats`
Get overall IAI system statistics.

**Response:**
```json
{
  "totalSoldiers": 3,
  "onlineSoldiers": 2,
  "workingSoldiers": 1,
  "offlineSoldiers": 0,
  "errorSoldiers": 0,
  "recentActivity": 45,
  "totalTasksCompleted": 128,
  "totalTasksFailed": 5
}
```

### Extension Endpoints (Protected)

#### `POST /api/extension/iai/register`
Register a new IAI soldier when extension starts.

**Request Body:**
```json
{
  "accountId": "uuid",
  "userId": "uuid",
  "browserId": "uuid",
  "extensionVersion": "3.3.0",
  "userAgent": "Mozilla/5.0...",
  "ipAddress": "192.0.2.1",
  "locationCountry": "United States",
  "locationCity": "New York",
  "locationLat": 40.7128,
  "locationLng": -74.0060,
  "timezone": "America/New_York"
}
```

**Response:**
```json
{
  "soldier": {
    "id": "uuid",
    "soldierId": "IAI-0",
    "status": "online"
  }
}
```

#### `POST /api/extension/iai/heartbeat`
Send status update every 30 seconds.

**Request Body:**
```json
{
  "soldierId": "IAI-0",
  "accountId": "uuid",
  "status": "online",
  "currentTaskId": "task-uuid",
  "currentTaskType": "POST_TO_MARKETPLACE",
  "cpuUsage": 45.2,
  "memoryUsageMb": 512
}
```

#### `POST /api/extension/iai/log-activity`
Log an activity event.

**Request Body:**
```json
{
  "soldierId": "IAI-0",
  "accountId": "uuid",
  "eventType": "task_start",
  "message": "Starting task POST_TO_MARKETPLACE",
  "taskId": "task-uuid",
  "taskType": "POST_TO_MARKETPLACE",
  "eventData": {
    "vehicleStockNumber": "12345"
  }
}
```

**Event Types:**
- `heartbeat` - Regular status ping
- `task_start` - Task execution begins
- `task_complete` - Task finished successfully
- `task_fail` - Task failed with error
- `status_change` - Status transition (online → working → idle)
- `error` - Error occurred

## 🎨 Dashboard Features

### Main View
- **Real-time stats cards** - Total, online, working, completed tasks
- **Status filtering** - Filter soldiers by current status
- **Live soldier cards** - Click to view details
- **Auto-refresh** - Updates every 5 seconds

### Soldier Cards Display
- **Soldier ID** (IAI-0, IAI-1, etc.)
- **Current status** with live indicator
- **Location** (City, Country)
- **Task completion metrics** (Completed, Failed, Success Rate)
- **Last seen** timestamp
- **Current task** (if working)

### Soldier Detail Modal
Three tabs with comprehensive information:

1. **Overview Tab**
   - Status grid (Status, Completed, Failed, Success Rate)
   - Soldier details (Version, Browser ID, Duration, Created date)
   - Location & heartbeat information
   - Error display (if any)

2. **Activity Tab**
   - Chronological event log
   - Event type badges
   - Expandable JSON data viewer
   - Task correlation
   - Time-sorted display

3. **Performance Tab**
   - Time-series snapshots
   - Task success/failure metrics
   - Average task duration
   - Status history

## 🚀 Deployment

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Prisma ORM
- Chrome Extension installed

### Setup Steps

1. **Apply Database Migration**
```bash
# Upload migration file
scp prisma/migrations/add_iai_soldiers.sql root@server:/tmp/

# Apply to database
docker exec postgres psql -U user -d db -f /tmp/add_iai_soldiers.sql
```

2. **Update Prisma Schema**
```bash
# Generate Prisma client
npx prisma generate
```

3. **Deploy Backend**
```bash
# Build TypeScript
npm run build

# Upload to server
scp -r dist/* root@server:/opt/facemydealer/dist/

# Restart API
docker restart facemydealer-api-1
```

4. **Deploy Web Dashboard**
```bash
cd web
npm run build
scp -r dist/* root@server:/opt/facemydealer/web/dist/
```

5. **Deploy Extension**
```bash
scp extension/background-ai.js root@server:/opt/facemydealer/extension/
```

### Post-Deployment Verification

1. **Check API Health**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://dealersface.com/api/admin/iai/stats
```

2. **Verify Database**
```bash
docker exec postgres psql -U user -d db \
  -c "SELECT COUNT(*) FROM iai_soldiers;"
```

3. **Test Extension**
- Load extension in Chrome
- Log in via side panel
- Check console for "IAI SOLDIER IAI-0 WAKING UP"
- Verify registration in dashboard

## 📈 Performance Optimizations

### Database
- **Indexed columns** for fast queries
- **Cascade deletes** for data integrity
- **Connection pooling** (Prisma default)
- **Query optimization** with selective includes

### API
- **Pagination** on all list endpoints
- **Response caching** (future: Redis integration)
- **Minimal data transfer** with selective field returns
- **Async operations** for non-blocking execution

### Frontend
- **TanStack Query** for intelligent caching
- **Auto-refresh intervals** (5s soldiers, 10s stats)
- **Lazy loading** for modal content
- **Code splitting** (Vite automatic)

## 🔧 Maintenance

### Monitoring
- Check dashboard daily for error soldiers
- Review activity logs for anomalies
- Monitor success rates per soldier
- Track heartbeat gaps (offline detection)

### Cleanup Tasks
```sql
-- Remove old activity logs (> 30 days)
DELETE FROM iai_activity_logs 
WHERE created_at < NOW() - INTERVAL '30 days';

-- Remove old performance snapshots (> 7 days)
DELETE FROM iai_performance_snapshots 
WHERE snapshot_at < NOW() - INTERVAL '7 days';

-- Deactivate stale soldiers (no heartbeat > 24h)
UPDATE iai_soldiers 
SET status = 'offline', is_active = false 
WHERE last_heartbeat_at < NOW() - INTERVAL '24 hours';
```

### Backup Strategy
```bash
# Daily database backup
pg_dump -U user -d db -t iai_* > iai_backup_$(date +%Y%m%d).sql
```

## 🐛 Troubleshooting

### Extension Not Registering
1. Check console for errors: `chrome://extensions → Details → Inspect views: service worker`
2. Verify authentication: Check if `authState` exists in `chrome.storage.local`
3. Test API connectivity: `fetch('https://dealersface.com/api/admin/iai/stats')`
4. Check network tab for 401/403 errors

### Heartbeats Not Updating
1. Verify `isPolling = true` in extension console
2. Check `checkIAIHeartbeat()` is running every 30s
3. Inspect network tab for heartbeat POST requests
4. Verify token hasn't expired (check response status)

### Dashboard Not Loading
1. Check browser console for errors
2. Verify API returns data: Test with curl/Postman
3. Check React Query devtools for failed queries
4. Verify authentication token in localStorage

### No Activity Logs
1. Ensure `soldierInfo` exists (registered successfully)
2. Check `logIAIActivity()` calls in background-ai.js
3. Verify POST requests to `/api/extension/iai/log-activity`
4. Check database for inserted records

## 🔐 Security Best Practices

### Production Checklist
- ✅ HTTPS only (no HTTP fallback)
- ✅ JWT tokens with expiration
- ✅ CORS restricted to known origins
- ✅ SQL injection prevention (Prisma ORM)
- ✅ XSS protection (React escaping)
- ✅ Rate limiting (future: implement with express-rate-limit)
- ✅ Audit logging for critical actions
- ✅ Environment variables for secrets
- ✅ Database connection encryption
- ✅ Regular security updates

### Ongoing Security
- Monitor for suspicious activity patterns
- Review audit logs weekly
- Update dependencies monthly
- Rotate secrets quarterly
- Penetration testing annually

## 📚 Code Quality

### TypeScript Strict Mode
- Full type safety enabled
- No implicit `any` types
- Strict null checks
- Unused variables detected

### Code Organization
- Clear separation of concerns
- Modular, reusable components
- Consistent naming conventions
- Comprehensive error handling

### Testing Strategy (Recommended)
```typescript
// Unit tests
describe('IAISoldier Registration', () => {
  it('should create unique soldier ID', async () => {
    const soldier = await registerIAISoldier();
    expect(soldier.soldierId).toMatch(/^IAI-\d+$/);
  });
});

// Integration tests
describe('IAI API', () => {
  it('should return soldiers list', async () => {
    const response = await fetch('/api/admin/iai/soldiers');
    expect(response.ok).toBe(true);
  });
});
```

## 🎯 Future Enhancements

### Planned Features
1. **Interactive Map** - Leaflet.js integration for geolocation visualization
2. **Real-time Notifications** - WebSocket for instant soldier updates
3. **Performance Dashboards** - Charts and graphs for metrics
4. **Automated Alerts** - Email/SMS when soldiers go offline
5. **Task Queue Management** - Direct task assignment from dashboard
6. **Soldier Commands** - Remote control (pause, resume, restart)
7. **Export Reports** - CSV/PDF download of activity logs
8. **Advanced Filtering** - Multi-criteria soldier search
9. **Historical Analytics** - Trend analysis over time
10. **Health Scoring** - AI-based soldier performance evaluation

### Technical Improvements
- Redis caching layer
- GraphQL API option
- Horizontal scaling support
- Multi-region deployment
- Advanced monitoring (Prometheus/Grafana)

## 📞 Support

### Contact
- **Email**: support@dealersface.com
- **Documentation**: https://dealersface.com/docs
- **Status Page**: https://status.dealersface.com

### Version
- **Current Version**: 1.0.0
- **Last Updated**: January 22, 2026
- **Database Version**: PostgreSQL 15
- **Node Version**: 18+
- **React Version**: 18+

---

**Built with ❤️ for production-grade automation monitoring**
