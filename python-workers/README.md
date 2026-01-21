# FaceMyDealer Python Workers - Headless Browser Automation

Scalable, multi-tenant headless browser infrastructure for Facebook Marketplace automation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Main Node.js Backend                        │
│                    (Railway/Your Server)                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP API / Redis Queue
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Python Worker Cluster                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Worker 1   │  │   Worker 2   │  │   Worker N   │          │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │          │
│  │ │Browser 1 │ │  │ │Browser 1 │ │  │ │Browser 1 │ │          │
│  │ │(Account A)│ │  │ │(Account C)│ │  │ │(Account E)│ │          │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │          │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │          │
│  │ │Browser 2 │ │  │ │Browser 2 │ │  │ │Browser 2 │ │          │
│  │ │(Account B)│ │  │ │(Account D)│ │  │ │(Account F)│ │          │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
                    ┌───────────────┐
                    │     Redis     │
                    │  Task Queue   │
                    │Session Cache  │
                    └───────────────┘
```

## Features

- **Multi-Tenant**: Each Facebook account gets its own isolated browser instance
- **Session Persistence**: Encrypted session storage survives container restarts
- **Auto-Scaling**: Add more workers by increasing Docker replica count
- **Anti-Detection**: Built-in measures to avoid Facebook bot detection
- **2FA Support**: Automatic TOTP-based 2FA or manual code entry
- **Health Monitoring**: Real-time worker and session health tracking

## Quick Start

### 1. Prerequisites

- Python 3.10+ 
- Redis instance (local or cloud)
- Your main FaceMyDealer backend running

**Optional for containerized deployment:**
- Docker & Docker Compose

### 2. Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
REDIS_URL=redis://your-redis-host:6379
API_BASE_URL=https://your-backend.railway.app
WORKER_SECRET=your-shared-secret
SESSION_SECRET=your-encryption-key
```

---

## Local Development (Without Docker)

### 1. Create Virtual Environment

```powershell
# Windows
python -m venv venv
.\venv\Scripts\Activate.ps1

# Linux/Mac
python -m venv venv
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Playwright Browsers

```bash
python -m playwright install chromium
```

### 4. Set Up Facebook Sessions

Before running workers, you need to set up sessions for each Facebook account:

```powershell
# Using the PowerShell helper script
.\run_setup_session.ps1

# Or directly with Python
python -m scripts.setup_session
```

This will:
1. Open a browser (visible mode)
2. Log into Facebook
3. Handle 2FA (manual or automatic with TOTP)
4. Save the encrypted session

### 5. Start Redis

You need Redis running locally or use a cloud Redis service.

**Local Redis (Windows - using Redis for Windows):**
```powershell
# Download from https://github.com/microsoftarchive/redis/releases
redis-server
```

**Or use Redis Cloud:**
- Update `REDIS_URL` in `.env` with your cloud Redis URL

### 6. Start the Worker API

```powershell
# Using helper script
.\run_api.ps1

# Or directly
.\venv\Scripts\python.exe -m uvicorn api.main:app --host 0.0.0.0 --port 8001
```

### 7. Start Workers

```powershell
# Using helper script (starts 3 posting workers)
.\run_worker.ps1 posting 3

# Or run a single worker directly
.\venv\Scripts\python.exe -m workers.posting_worker
```

---

## Docker Deployment

### 1. Start Workers with Docker

```bash
# Start all services
docker-compose up -d

# Scale workers
docker-compose up -d --scale browser-worker=5
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Create Task
```bash
POST /api/tasks
X-API-Key: your-secret

{
  "type": "post_vehicle",
  "account_id": "dealer-1",
  "data": {
    "vehicle": {
      "year": 2022,
      "make": "Toyota",
      "model": "Camry",
      "price": 25000,
      "mileage": 15000
    },
    "photos": ["https://..."],
    "groups": ["group-id-1", "group-id-2"]
  }
}
```

### Post Vehicle (Convenience)
```bash
POST /api/post-vehicle
X-API-Key: your-secret

{
  "account_id": "dealer-1",
  "vehicle": {
    "year": 2022,
    "make": "Toyota",
    "model": "Camry",
    "price": 25000,
    "location": "Miami, FL"
  },
  "photos": ["https://..."]
}
```

### List Workers
```bash
GET /api/workers
X-API-Key: your-secret
```

### List Sessions
```bash
GET /api/sessions
X-API-Key: your-secret
```

## Integration with Main Backend

Add this to your Node.js backend to queue tasks:

```typescript
// src/services/workerQueue.service.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function queueVehiclePosting(
  accountId: string,
  vehicleData: VehicleData,
  photos: string[]
) {
  const task = {
    id: `task_${Date.now()}`,
    type: 'post_vehicle',
    account_id: accountId,
    data: {
      vehicle: vehicleData,
      photos: photos
    },
    priority: 'normal',
    created_at: new Date().toISOString()
  };
  
  await redis.lpush('facemydealer:tasks', JSON.stringify(task));
  return task.id;
}
```

## Directory Structure

```
python-workers/
├── api/                    # FastAPI endpoints
│   ├── __init__.py
│   └── main.py
├── browser/                # Browser management
│   ├── __init__.py
│   ├── manager.py          # Browser pool
│   ├── session.py          # Session encryption
│   └── anti_detect.py      # Bot detection evasion
├── core/                   # Core utilities
│   ├── __init__.py
│   ├── config.py           # Settings
│   └── redis_client.py     # Redis queue
├── facebook/               # Facebook automation
│   ├── __init__.py
│   ├── auth.py             # Login/2FA
│   ├── marketplace.py      # Posting logic
│   └── selectors.py        # DOM selectors
├── workers/                # Worker processes
│   ├── __init__.py
│   ├── posting_worker.py   # Main worker
│   ├── session_worker.py   # Session monitor
│   └── task_processor.py   # Task execution
├── scripts/
│   └── setup_session.py    # Interactive setup
├── data/
│   └── sessions/           # Encrypted sessions (gitignored)
├── docker-compose.yml
├── Dockerfile.worker
├── requirements.txt
└── README.md
```

## Scaling

### Horizontal Scaling

```bash
# Scale to 10 workers
docker-compose up -d --scale browser-worker=10
```

Each worker can handle multiple browser instances (default 5 per worker).

### Resource Requirements

Per worker:
- CPU: 1-2 cores
- RAM: 2-4 GB
- Disk: 1 GB for sessions

### Production Deployment

For production, consider:
1. **Railway**: Deploy as separate service
2. **AWS ECS**: Auto-scaling container service
3. **Kubernetes**: Full orchestration with HPA

## Troubleshooting

### Session Expired
```bash
# Re-run setup for the account
python -m scripts.setup_session
# Select option 1, enter credentials
```

### Worker Not Processing
```bash
# Check worker logs
docker-compose logs -f browser-worker

# Check Redis queue
redis-cli LLEN facemydealer:tasks
```

### Facebook Blocking
1. Slow down posting (increase delays)
2. Use different user agents
3. Rotate accounts
4. Review anti-detection settings

## Security Notes

- Sessions are encrypted with AES-256 (Fernet)
- Passwords should never be stored long-term
- Use environment variables for secrets
- The `data/sessions/` folder should have restricted permissions
