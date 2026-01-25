# 🔄 Unified IAI Architecture: Desktop + Server Mirror TODO

## Strategic Overview

**Goal**: Create a unified system where IAI runs identically in both:
1. **Desktop Chrome** (user's browser via extension)
2. **Server Chromium** (headless via Nova workers)

Both instances use the same API, same code, same session, and can be controlled from the same dashboard.

**Key Benefits**:
- Instant tasks when user is online (Desktop IAI)
- Scheduled/24/7 tasks when user is offline (Server IAI)
- Failover: If desktop goes offline, server takes over
- Session sharing: Login once, use everywhere
- Same codebase: Maintain one IAI, deploy everywhere

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DealersFace API Server                            │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Session   │  │    Task     │  │  Scheduler  │  │ Coordinator │    │
│  │   Store     │  │   Queue     │  │   Service   │  │   Service   │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
│         │                │                │                │            │
└─────────┼────────────────┼────────────────┼────────────────┼────────────┘
          │                │                │                │
          │    ┌───────────┴───────────┐    │                │
          │    │                       │    │                │
          ▼    ▼                       ▼    ▼                ▼
┌─────────────────────────┐    ┌─────────────────────────────────────────┐
│   Desktop Chrome        │    │        Server Nova Workers               │
│   (User's Browser)      │    │        (Headless Chromium)               │
│                         │    │                                          │
│  ┌───────────────────┐  │    │  ┌──────────────────────────────────┐   │
│  │  DealersFace      │  │    │  │  Python Worker Container          │   │
│  │  Extension        │  │    │  │                                    │   │
│  │                   │  │    │  │  ┌────────────────────────────┐   │   │
│  │  ┌─────────────┐  │  │    │  │  │  Playwright Chromium        │   │   │
│  │  │ IAI Soldier │  │  │    │  │  │                              │   │   │
│  │  │ (JS)        │  │  │    │  │  │  ┌────────────────────────┐ │   │   │
│  │  │             │  │  │    │  │  │  │ IAI Soldier (injected) │ │   │   │
│  │  │ Same code!  │◄─┼──┼────┼──┼──┼──│ Same code!             │ │   │   │
│  │  │             │  │  │    │  │  │  └────────────────────────┘ │   │   │
│  │  └─────────────┘  │  │    │  │  │           +                  │   │   │
│  │         │         │  │    │  │  │  ┌────────────────────────┐ │   │   │
│  │         │ Uses    │  │    │  │  │  │ Nova Vision (AI brain) │ │   │   │
│  │         ▼         │  │    │  │  │  │ - Screenshot analysis  │ │   │   │
│  │  Same API calls   │  │    │  │  │  │ - Error recovery       │ │   │   │
│  │  Same endpoints   │  │    │  │  │  └────────────────────────┘ │   │   │
│  │  Same auth        │  │    │  │  └────────────────────────────┘   │   │
│  └───────────────────┘  │    │  └──────────────────────────────────┘   │
│                         │    │                                          │
│  Source: User session   │    │  Source: Synced session from extension   │
│  Control: Manual/Auto   │    │  Control: Scheduled/Failover             │
│                         │    │                                          │
└─────────────────────────┘    └─────────────────────────────────────────┘
          │                                        │
          │         Session Sync (encrypted)       │
          └────────────────────────────────────────┘
```

---

## Phase 1: Session Synchronization

### 1.1 Session Export from Extension

- [ ] **Create session export function**
  ```javascript
  // extension/session-sync.js
  
  async function exportSessionForServer() {
    const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
    const localStorage = await getLocalStorageFromFB();
    
    // Get storage state in Playwright format
    const storageState = {
      cookies: cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expirationDate,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite
      })),
      origins: [{
        origin: 'https://www.facebook.com',
        localStorage: localStorage
      }]
    };
    
    // Send to server
    const response = await fetch(`${API_URL}/extension/session/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountId,
        storageState,
        source: 'extension',
        timestamp: Date.now()
      })
    });
    
    return response.json();
  }
  ```

- [ ] **Auto-sync on session changes**
  ```javascript
  // Watch for cookie changes and sync
  chrome.cookies.onChanged.addListener(async (changeInfo) => {
    if (changeInfo.cookie.domain.includes('facebook.com')) {
      // Debounce syncs
      clearTimeout(syncTimeout);
      syncTimeout = setTimeout(async () => {
        await exportSessionForServer();
      }, 5000);
    }
  });
  ```

- [ ] **Manual sync button in extension UI**
  ```html
  <button id="sync-to-server" class="sync-btn">
    <span class="icon">🔄</span>
    Sync Session to Server
  </button>
  ```

### 1.2 Session Import to Nova Workers

- [ ] **Create Python session import service**
  ```python
  # python-workers/services/session_sync.py
  
  class SessionSyncService:
      def __init__(self, api_url: str, api_token: str):
          self.api_url = api_url
          self.api_token = api_token
      
      async def fetch_session(self, account_id: str) -> Optional[StorageState]:
          """Fetch latest session from API"""
          response = await self.http.get(
              f"{self.api_url}/internal/session/{account_id}",
              headers={"Authorization": f"Bearer {self.api_token}"}
          )
          
          if response.status_code != 200:
              return None
          
          data = response.json()
          return StorageState(
              cookies=data['cookies'],
              origins=data['origins']
          )
      
      async def get_latest_session(
          self, 
          account_id: str,
          local_session: Optional[StorageState]
      ) -> StorageState:
          """Get newest session between local and remote"""
          remote = await self.fetch_session(account_id)
          
          if not remote:
              return local_session
          
          if not local_session:
              return remote
          
          # Compare timestamps, use newer
          if remote.timestamp > local_session.timestamp:
              logger.info("Using newer session from extension",
                         account_id=account_id)
              return remote
          
          return local_session
  ```

- [ ] **Integrate with BrowserPoolManager**
  ```python
  # python-workers/browser/manager.py
  
  async def _create_browser(self, account_id: str) -> BrowserInstance:
      # Try to get synced session first
      session = await self.session_sync.get_latest_session(
          account_id,
          await self.session_manager.load_session(account_id)
      )
      
      context = await self._browser.new_context(
          storage_state=session.to_dict() if session else None,
          # ... other options
      )
      
      return BrowserInstance(...)
  ```

### 1.3 Server Session API Endpoints

- [ ] **POST `/api/extension/session/sync`**
  ```typescript
  router.post('/session/sync', authenticate, async (req, res) => {
    const { accountId, storageState, source, timestamp } = req.body;
    
    // Validate ownership
    if (!await userOwnsAccount(req.user.id, accountId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Encrypt and store
    const encrypted = await cryptoService.encrypt(
      JSON.stringify(storageState),
      process.env.SESSION_ENCRYPTION_KEY
    );
    
    await prisma.fbSession.upsert({
      where: { accountId_source: { accountId, source } },
      update: {
        encryptedState: encrypted.data,
        encryptionSalt: encrypted.salt,
        syncedAt: new Date(timestamp),
        updatedAt: new Date()
      },
      create: {
        accountId,
        source,
        encryptedState: encrypted.data,
        encryptionSalt: encrypted.salt,
        syncedAt: new Date(timestamp)
      }
    });
    
    res.json({ success: true, syncedAt: timestamp });
  });
  ```

- [ ] **GET `/api/internal/session/:accountId`** (worker-only)
  ```typescript
  router.get('/internal/session/:accountId', workerAuth, async (req, res) => {
    const { accountId } = req.params;
    
    const session = await prisma.fbSession.findFirst({
      where: { accountId, status: 'ACTIVE' },
      orderBy: { syncedAt: 'desc' }
    });
    
    if (!session) {
      return res.status(404).json({ error: 'No session found' });
    }
    
    // Decrypt
    const decrypted = await cryptoService.decrypt(
      session.encryptedState,
      session.encryptionSalt,
      process.env.SESSION_ENCRYPTION_KEY
    );
    
    res.json({
      ...JSON.parse(decrypted),
      timestamp: session.syncedAt.getTime()
    });
  });
  ```

---

## Phase 2: IAI Code Injection into Chromium

### 2.1 Package IAI for Server Deployment

- [ ] **Create server-compatible IAI bundle**
  ```python
  # python-workers/browser/iai_injector.py
  
  import os
  
  class IAIInjector:
      def __init__(self):
          # Load IAI soldier code
          iai_path = os.path.join(
              os.path.dirname(__file__),
              '..', '..', 'extension', 'iai-soldier.js'
          )
          with open(iai_path, 'r') as f:
              self.iai_code = f.read()
          
          # Modify for server environment
          self.iai_code = self._adapt_for_server(self.iai_code)
      
      def _adapt_for_server(self, code: str) -> str:
          """Adapt extension code for Playwright injection"""
          # Remove chrome.* API calls
          code = code.replace(
              'chrome.storage.local',
              'window.__IAI_STORAGE__'
          )
          code = code.replace(
              'chrome.runtime.getManifest()',
              '{ version: "server" }'
          )
          
          # Add server-specific config
          server_config = """
          window.__IAI_SERVER_MODE__ = true;
          window.__IAI_STORAGE__ = {
            get: async (keys) => window.__IAI_STATE__ || {},
            set: async (data) => { window.__IAI_STATE__ = {...window.__IAI_STATE__, ...data}; }
          };
          """
          
          return server_config + code
      
      async def inject(self, page: Page) -> None:
          """Inject IAI into page"""
          await page.add_init_script(self.iai_code)
  ```

- [ ] **Dockerfile update to include extension code**
  ```dockerfile
  # python-workers/Dockerfile.worker
  
  # ... existing content ...
  
  # Copy extension code for IAI injection
  COPY extension/iai-soldier.js /app/extension/
  COPY extension/iai-selectors.js /app/extension/
  ```

### 2.2 Hybrid Command Interface

- [ ] **Create Python ↔ IAI bridge**
  ```python
  # python-workers/browser/iai_bridge.py
  
  class IAIBridge:
      """Bridge between Python Nova and JavaScript IAI"""
      
      def __init__(self, page: Page, injector: IAIInjector):
          self.page = page
          self.injector = injector
          self._initialized = False
      
      async def initialize(self) -> None:
          """Initialize IAI in the page"""
          if self._initialized:
              return
          
          await self.injector.inject(self.page)
          
          # Wait for IAI to be ready
          await self.page.wait_for_function(
              "() => window.__IAI_SOLDIER__ !== undefined"
          )
          
          self._initialized = True
      
      async def execute_action(
          self, 
          action: str, 
          params: Dict[str, Any]
      ) -> Dict[str, Any]:
          """Execute an IAI action"""
          await self.initialize()
          
          result = await self.page.evaluate(f"""
              async () => {{
                  try {{
                      const soldier = window.__IAI_SOLDIER__;
                      const result = await soldier.{action}({json.dumps(params)});
                      return {{ success: true, data: result }};
                  }} catch (error) {{
                      return {{ success: false, error: error.message }};
                  }}
              }}
          """)
          
          return result
      
      # Convenience methods
      async def navigate_to(self, destination: str) -> bool:
          return await self.execute_action('navigateTo', {'destination': destination})
      
      async def create_listing(self, vehicle_data: Dict) -> bool:
          return await self.execute_action('createListing', vehicle_data)
      
      async def send_message(self, conversation_id: str, text: str) -> bool:
          return await self.execute_action('sendMessage', {
              'conversationId': conversation_id,
              'text': text
          })
      
      async def scrape_messages(self) -> List[Dict]:
          return await self.execute_action('scrapeConversations', {})
  ```

### 2.3 Unified Task Execution

- [ ] **Create unified task executor**
  ```python
  # python-workers/tasks/unified_executor.py
  
  class UnifiedTaskExecutor:
      """
      Executes tasks using either:
      1. IAI (injected JavaScript) for reliable automation
      2. Nova (Python + AI) for complex reasoning
      """
      
      def __init__(
          self, 
          controller: NovaController,
          iai_bridge: IAIBridge,
          vision: NovaVisionService
      ):
          self.controller = controller
          self.iai = iai_bridge
          self.vision = vision
      
      async def execute_task(self, task: ExtensionTask) -> TaskResult:
          """Execute task with best available method"""
          
          if task.type == 'POST_TO_MARKETPLACE':
              return await self._post_vehicle(task.data)
          
          elif task.type == 'RESPOND_TO_MESSAGE':
              return await self._respond_to_message(task.data)
          
          elif task.type == 'SCRAPE_MESSAGES':
              return await self._scrape_messages(task.data)
          
          else:
              raise ValueError(f"Unknown task type: {task.type}")
      
      async def _post_vehicle(self, data: Dict) -> TaskResult:
          """Post vehicle using IAI with Nova fallback"""
          try:
              # Primary: Use IAI (battle-tested selectors)
              result = await self.iai.create_listing(data['vehicle'])
              
              if result['success']:
                  return TaskResult(success=True, data=result['data'])
              
              # Fallback: Use Nova with vision
              logger.warning("IAI failed, falling back to Nova vision")
              return await self._post_vehicle_with_nova(data)
              
          except Exception as e:
              logger.error("Vehicle posting failed", error=str(e))
              return TaskResult(success=False, error=str(e))
      
      async def _post_vehicle_with_nova(self, data: Dict) -> TaskResult:
          """Fallback: Use Nova's AI vision for posting"""
          agent = NovaAgent(self.controller, self.vision)
          
          result = await agent.execute_goal(
              f"Create a vehicle listing for: {data['vehicle']['year']} "
              f"{data['vehicle']['make']} {data['vehicle']['model']} "
              f"priced at ${data['vehicle']['price']}",
              context=data
          )
          
          return TaskResult(
              success=result.success,
              data=result.data,
              error=result.error
          )
  ```

---

## Phase 3: Unified API Interface

### 3.1 Same Endpoints for Both Clients

Both Desktop IAI and Server IAI use these endpoints:

- [ ] **`GET /api/extension/tasks/:accountId`** - Get pending tasks
- [ ] **`POST /api/extension/tasks/:taskId/start`** - Mark task started
- [ ] **`POST /api/extension/tasks/:taskId/complete`** - Mark task complete
- [ ] **`POST /api/extension/tasks/:taskId/fail`** - Mark task failed
- [ ] **`POST /api/extension/heartbeat`** - Send heartbeat
- [ ] **`POST /api/extension/iai/register`** - Register IAI instance
- [ ] **`POST /api/extension/iai/log-activity`** - Log activity

### 3.2 Instance Identification

- [ ] **Add instance type to requests**
  ```typescript
  interface IAIInstance {
    instanceId: string;
    instanceType: 'desktop' | 'server';
    accountId: string;
    capabilities: string[];
    lastSeen: Date;
  }
  ```

- [ ] **Track active instances**
  ```typescript
  // In-memory or Redis
  const activeInstances = new Map<string, IAIInstance>();
  
  router.post('/iai/register', authenticate, async (req, res) => {
    const { instanceType, browserId, capabilities } = req.body;
    
    const instance: IAIInstance = {
      instanceId: `${instanceType}-${browserId}`,
      instanceType,
      accountId: req.body.accountId,
      capabilities,
      lastSeen: new Date()
    };
    
    activeInstances.set(instance.instanceId, instance);
    
    res.json({ success: true, instance });
  });
  ```

---

## Phase 4: Task Coordination

### 4.1 Prevent Duplicate Execution

- [ ] **Add task locking mechanism**
  ```typescript
  // src/services/task-coordinator.service.ts
  
  class TaskCoordinatorService {
    private redis: Redis;
    
    async acquireTaskLock(
      taskId: string, 
      instanceId: string,
      ttlSeconds: number = 300
    ): Promise<boolean> {
      const lockKey = `task:lock:${taskId}`;
      
      // Try to acquire lock
      const acquired = await this.redis.set(
        lockKey,
        instanceId,
        'NX',      // Only set if not exists
        'EX',      // Expire after
        ttlSeconds
      );
      
      return acquired === 'OK';
    }
    
    async releaseTaskLock(taskId: string, instanceId: string): Promise<void> {
      const lockKey = `task:lock:${taskId}`;
      
      // Only release if we own the lock
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      await this.redis.eval(script, 1, lockKey, instanceId);
    }
    
    async getTaskOwner(taskId: string): Promise<string | null> {
      return await this.redis.get(`task:lock:${taskId}`);
    }
  }
  ```

- [ ] **Coordinate task assignment**
  ```typescript
  async function assignTask(
    task: ExtensionTask,
    instances: IAIInstance[]
  ): Promise<string | null> {
    // Prefer desktop if online (faster, user present)
    const desktop = instances.find(i => 
      i.instanceType === 'desktop' && 
      isRecent(i.lastSeen, 60000)
    );
    
    if (desktop) {
      return desktop.instanceId;
    }
    
    // Fall back to server
    const server = instances.find(i => 
      i.instanceType === 'server' && 
      isRecent(i.lastSeen, 60000)
    );
    
    return server?.instanceId || null;
  }
  ```

### 4.2 Failover Logic

- [ ] **Implement automatic failover**
  ```typescript
  // src/services/failover.service.ts
  
  class FailoverService {
    async checkAndFailover(accountId: string): Promise<void> {
      const instances = await this.getInstances(accountId);
      
      const desktop = instances.find(i => i.instanceType === 'desktop');
      const server = instances.find(i => i.instanceType === 'server');
      
      // If desktop is offline and there are pending tasks
      if (!desktop || !isRecent(desktop.lastSeen, 120000)) {
        const pendingTasks = await this.getPendingTasks(accountId);
        
        if (pendingTasks.length > 0 && server) {
          logger.info('Desktop offline, failing over to server',
            { accountId, taskCount: pendingTasks.length });
          
          // Reassign tasks to server
          for (const task of pendingTasks) {
            await this.assignToInstance(task.id, server.instanceId);
          }
        }
      }
    }
  }
  ```

- [ ] **Periodic failover check**
  ```typescript
  // Run every minute
  setInterval(async () => {
    const accounts = await getActiveAccounts();
    
    for (const account of accounts) {
      await failoverService.checkAndFailover(account.id);
    }
  }, 60000);
  ```

---

## Phase 5: Scheduling System

### 5.1 Task Scheduling

- [ ] **Create scheduling tables**
  ```prisma
  model ScheduledTask {
    id            String   @id @default(cuid())
    accountId     String
    taskType      String
    taskData      Json
    cronExpression String?          // e.g., "0 9 * * *" (9 AM daily)
    nextRunAt     DateTime
    lastRunAt     DateTime?
    status        ScheduleStatus @default(ACTIVE)
    preferredInstance String?       // 'desktop' | 'server' | null (any)
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
    
    account       Account  @relation(fields: [accountId], references: [id])
    @@index([nextRunAt, status])
  }
  
  enum ScheduleStatus {
    ACTIVE
    PAUSED
    COMPLETED
  }
  ```

- [ ] **Create scheduling service**
  ```typescript
  // src/services/scheduler.service.ts
  
  class SchedulerService {
    async createSchedule(data: CreateScheduleDto): Promise<ScheduledTask> {
      const nextRun = this.calculateNextRun(data.cronExpression);
      
      return prisma.scheduledTask.create({
        data: {
          accountId: data.accountId,
          taskType: data.taskType,
          taskData: data.taskData,
          cronExpression: data.cronExpression,
          nextRunAt: nextRun,
          preferredInstance: data.preferredInstance
        }
      });
    }
    
    async processScheduledTasks(): Promise<void> {
      const dueTasks = await prisma.scheduledTask.findMany({
        where: {
          status: 'ACTIVE',
          nextRunAt: { lte: new Date() }
        }
      });
      
      for (const scheduled of dueTasks) {
        // Create actual task
        await prisma.extensionTask.create({
          data: {
            accountId: scheduled.accountId,
            type: scheduled.taskType,
            data: scheduled.taskData,
            status: 'pending',
            source: 'scheduler'
          }
        });
        
        // Update next run
        const nextRun = this.calculateNextRun(scheduled.cronExpression);
        await prisma.scheduledTask.update({
          where: { id: scheduled.id },
          data: {
            lastRunAt: new Date(),
            nextRunAt: nextRun
          }
        });
      }
    }
  }
  ```

### 5.2 Scheduling API

- [ ] **POST `/api/schedules`** - Create schedule
- [ ] **GET `/api/schedules/:accountId`** - List schedules
- [ ] **PATCH `/api/schedules/:id`** - Update schedule
- [ ] **DELETE `/api/schedules/:id`** - Delete schedule
- [ ] **POST `/api/schedules/:id/pause`** - Pause schedule
- [ ] **POST `/api/schedules/:id/resume`** - Resume schedule

### 5.3 Scheduling UI

- [ ] **Create SchedulingPage component**
  ```tsx
  const SchedulingPage = () => {
    return (
      <Page title="Automation Schedules">
        <ScheduleList />
        <CreateScheduleDialog />
        
        <ScheduleTemplates>
          <Template 
            name="Daily Inventory Sync"
            description="Post new vehicles every morning"
            cron="0 9 * * *"
          />
          <Template 
            name="Message Check"
            description="Check messages every 2 hours"
            cron="0 */2 * * *"
          />
        </ScheduleTemplates>
      </Page>
    );
  };
  ```

---

## Phase 6: Dashboard Integration

### 6.1 Instance Status Widget

- [ ] **Create InstanceStatusWidget**
  ```tsx
  const InstanceStatusWidget = ({ accountId }) => {
    const { instances } = useIAIInstances(accountId);
    
    const desktop = instances.find(i => i.instanceType === 'desktop');
    const server = instances.find(i => i.instanceType === 'server');
    
    return (
      <Widget title="IAI Instances">
        <InstanceCard
          icon="🖥️"
          name="Desktop Chrome"
          status={desktop ? (isOnline(desktop) ? 'online' : 'offline') : 'not-configured'}
          lastSeen={desktop?.lastSeen}
          capabilities={desktop?.capabilities}
        />
        
        <InstanceCard
          icon="🌐"
          name="Server Nova"
          status={server ? (isOnline(server) ? 'online' : 'offline') : 'not-configured'}
          lastSeen={server?.lastSeen}
          capabilities={server?.capabilities}
        />
        
        <SessionSyncStatus 
          desktop={desktop}
          server={server}
        />
      </Widget>
    );
  };
  ```

### 6.2 Real-time Activity Feed

- [ ] **Create unified activity feed**
  ```tsx
  const UnifiedActivityFeed = ({ accountId }) => {
    const { activities } = useIAIActivities(accountId);
    
    return (
      <ActivityFeed>
        {activities.map(activity => (
          <ActivityItem key={activity.id}>
            <InstanceBadge type={activity.instanceType} />
            <ActivityContent>
              <strong>{activity.action}</strong>
              <span>{activity.message}</span>
            </ActivityContent>
            <Timestamp>{activity.timestamp}</Timestamp>
          </ActivityItem>
        ))}
      </ActivityFeed>
    );
  };
  ```

### 6.3 Task Execution Viewer

- [ ] **Show which instance executed each task**
  ```tsx
  const TaskExecutionViewer = ({ taskId }) => {
    const { task, execution } = useTaskExecution(taskId);
    
    return (
      <ExecutionDetails>
        <Header>
          <TaskType>{task.type}</TaskType>
          <StatusBadge status={task.status} />
        </Header>
        
        <ExecutionInfo>
          <Label>Executed By:</Label>
          <Value>
            {execution.instanceType === 'desktop' 
              ? '🖥️ Desktop Chrome' 
              : '🌐 Server Nova'}
          </Value>
        </ExecutionInfo>
        
        <ExecutionTimeline>
          <Step status="complete">Task Created</Step>
          <Step status="complete">Instance Assigned</Step>
          <Step status={execution.status}>Execution</Step>
          <Step status={task.status === 'completed' ? 'complete' : 'pending'}>
            Completion
          </Step>
        </ExecutionTimeline>
        
        {execution.screenshots && (
          <ScreenshotGallery images={execution.screenshots} />
        )}
      </ExecutionDetails>
    );
  };
  ```

---

## Phase 7: Server IAI Worker Updates

### 7.1 Worker Configuration

- [ ] **Add IAI mode to worker config**
  ```python
  # python-workers/core/config.py
  
  class Settings(BaseSettings):
      # Existing settings...
      
      # IAI Mode
      iai_enabled: bool = True
      iai_injection_path: str = "/app/extension/iai-soldier.js"
      
      # Hybrid mode settings
      use_iai_for_posting: bool = True
      use_iai_for_messaging: bool = True
      use_nova_for_recovery: bool = True  # Fallback to AI vision
  ```

### 7.2 Update Docker Compose

- [ ] **Mount extension code in worker containers**
  ```yaml
  # docker-compose.production.yml
  
  browser-worker:
    build:
      context: ./python-workers
      dockerfile: Dockerfile.worker
    volumes:
      - ./extension:/app/extension:ro  # Read-only mount
    environment:
      - IAI_ENABLED=true
      - IAI_INJECTION_PATH=/app/extension/iai-soldier.js
  ```

### 7.3 Worker Task Handler

- [ ] **Update task handler to use IAI**
  ```python
  # python-workers/tasks/handler.py
  
  class TaskHandler:
      def __init__(self, pool: BrowserPoolManager):
          self.pool = pool
          self.iai_injector = IAIInjector()
      
      async def handle_task(self, task: Dict) -> TaskResult:
          browser = await self.pool.get_browser(task['accountId'])
          
          if not browser:
              return TaskResult(success=False, error="No browser available")
          
          try:
              # Initialize IAI bridge
              bridge = IAIBridge(browser.page, self.iai_injector)
              await bridge.initialize()
              
              # Execute task
              executor = UnifiedTaskExecutor(
                  NovaController(browser),
                  bridge,
                  NovaVisionService()
              )
              
              return await executor.execute_task(task)
              
          finally:
              browser.touch()
  ```

---

## Phase 8: Extension Updates

### 8.1 Server-Aware Extension

- [ ] **Add server status awareness**
  ```javascript
  // Check if server IAI is available
  async function checkServerStatus() {
    try {
      const response = await fetch(`${API_URL}/extension/server-status`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      const data = await response.json();
      return data.serverOnline;
    } catch {
      return false;
    }
  }
  
  // Show in UI
  async function updateStatusUI() {
    const serverOnline = await checkServerStatus();
    
    document.getElementById('server-status').innerHTML = serverOnline
      ? '🌐 Server: Online'
      : '🌐 Server: Offline';
  }
  ```

### 8.2 Instance Preference Setting

- [ ] **Let user choose preferred instance**
  ```html
  <div class="instance-preference">
    <h4>Execution Preference</h4>
    
    <label>
      <input type="radio" name="preference" value="desktop" checked>
      Prefer Desktop (when available)
    </label>
    
    <label>
      <input type="radio" name="preference" value="server">
      Prefer Server (24/7)
    </label>
    
    <label>
      <input type="radio" name="preference" value="auto">
      Auto (fastest available)
    </label>
  </div>
  ```

### 8.3 Session Sync UI

- [ ] **Add sync status and controls**
  ```html
  <div class="session-sync">
    <h4>Session Sync</h4>
    
    <div class="sync-status">
      <span class="icon">🔄</span>
      <span class="text">Last synced: 2 hours ago</span>
    </div>
    
    <button id="sync-now">Sync Now</button>
    
    <label class="auto-sync">
      <input type="checkbox" checked>
      Auto-sync every 4 hours
    </label>
  </div>
  ```

---

## Phase 9: Testing

### 9.1 Unit Tests

- [ ] Test session encryption/decryption
- [ ] Test IAI injection
- [ ] Test IAI bridge commands
- [ ] Test task coordination
- [ ] Test failover logic
- [ ] Test scheduling

### 9.2 Integration Tests

- [ ] Test session sync flow (ext → server)
- [ ] Test task execution on desktop
- [ ] Test task execution on server
- [ ] Test failover from desktop to server
- [ ] Test coordinated execution (no duplicates)

### 9.3 End-to-End Tests

- [ ] Full posting flow on desktop
- [ ] Full posting flow on server
- [ ] Scheduled task execution
- [ ] Session expiry and recovery
- [ ] Multi-instance coordination

---

## Phase 10: Documentation

### 10.1 Architecture Documentation

- [ ] System architecture diagram
- [ ] Data flow documentation
- [ ] Security documentation
- [ ] API documentation

### 10.2 User Documentation

- [ ] Setup guide for desktop extension
- [ ] Server setup guide
- [ ] Scheduling guide
- [ ] Troubleshooting guide

### 10.3 Developer Documentation

- [ ] Code organization
- [ ] Adding new task types
- [ ] Extending IAI capabilities
- [ ] Debugging guide

---

## Implementation Order

1. **Session Sync** (Phase 1, 3) - Foundation for sharing
2. **IAI Injection** (Phase 2) - Run IAI on server
3. **Task Coordination** (Phase 4) - Prevent duplicates
4. **Unified API** (Phase 3) - Same interface
5. **Scheduling** (Phase 5) - Automated execution
6. **Dashboard** (Phase 6) - Visibility
7. **Worker Updates** (Phase 7) - Server implementation
8. **Extension Updates** (Phase 8) - Desktop integration
9. **Testing** (Phase 9) - Validation
10. **Documentation** (Phase 10) - Knowledge transfer

---

## Success Criteria

- [ ] Sessions sync reliably between desktop and server
- [ ] IAI code runs identically on both platforms
- [ ] Tasks execute without duplicates
- [ ] Failover works automatically
- [ ] Scheduling works 24/7
- [ ] Dashboard shows unified view
- [ ] All tests passing
- [ ] Documentation complete
